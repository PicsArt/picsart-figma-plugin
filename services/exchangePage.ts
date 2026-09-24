import {
    EXCHANGE_PAGE_URL,
    EXCHANGE_TIMEOUT_MS,
    OAUTH_CLIENT_ID,
    OAUTH_REDIRECT_URI,
    TYPE_EXCHANGE_PAGE_READY,
    TYPE_EXCHANGE_REQUEST,
    TYPE_EXCHANGE_RESULT,
    TYPE_LOAD_EXCHANGE_PAGE,
} from "@constants/index";
import { authLog } from "./authLog";
import type { TokenFailureReason } from "./oauthClient";
import { addUiMessageHandler, postToUi } from "./UiBridge";

export interface ExchangePageInfo {
    clientId?: string;
    redirectUri?: string;
    pageOrigin?: string;
    secureContext?: boolean;
}

let page: ExchangePageInfo | undefined;
let requested = false;
let nextNonce = 0;
const waiters = new Map<number, (result: ExchangeReply) => void>();

export type ExchangeReply =
    | {
          ok: true;
          access_token?: unknown;
          id_token?: unknown;
          refresh_token?: unknown;
          expires_in?: unknown;
          scope?: unknown;
      }
    | {
          ok: false;
          reason: TokenFailureReason;
          error?: string;
          status?: number;
          throttled?: boolean;
      };

interface IncomingExchangeMessage {
    type?: string;
    nonce?: number;
    ok?: boolean;
    error?: string;
    status?: number;
    throttled?: boolean;
    clientId?: string;
    redirectUri?: string;
    pageOrigin?: string;
    secureContext?: boolean;
    [key: string]: unknown;
}

const classify = (message: IncomingExchangeMessage): TokenFailureReason => {
    if (typeof message.status === "number" && message.status > 0) {
        return /invalid_grant/i.test(String(message.error ?? "")) ? "invalid_grant" : "http";
    }
    if (message.throttled) return "blocked";
    return "unreachable";
};

const handleMessage = (message: IncomingExchangeMessage) => {
    if (!message) return;

    if (message.type === TYPE_EXCHANGE_PAGE_READY) {
        page = {
            clientId: message.clientId,
            redirectUri: message.redirectUri,
            pageOrigin: message.pageOrigin,
            secureContext: message.secureContext,
        };

        if (page.clientId && page.clientId !== OAUTH_CLIENT_ID) {
            authLog("the exchange page is pinned to a different client than this build", {
                page: page.clientId,
                plugin: OAUTH_CLIENT_ID,
            });
        }
        if (page.redirectUri && page.redirectUri !== OAUTH_REDIRECT_URI) {
            authLog("the exchange page is pinned to a different redirect_uri", {
                page: page.redirectUri,
                plugin: OAUTH_REDIRECT_URI,
            });
        }
        if (!page.pageOrigin || page.pageOrigin === "null") {
            authLog("the exchange page reported an opaque origin; the exchange cannot work");
        }
        return;
    }

    if (message.type === TYPE_EXCHANGE_RESULT) {
        const waiter = typeof message.nonce === "number" ? waiters.get(message.nonce) : undefined;
        if (!waiter) return;
        waiters.delete(message.nonce as number);
        waiter(
            message.ok
                ? {
                      ok: true,
                      access_token: message.access_token,
                      id_token: message.id_token,
                      refresh_token: message.refresh_token,
                      expires_in: message.expires_in,
                      scope: message.scope,
                  }
                : {
                      ok: false,
                      reason: classify(message),
                      error: message.error,
                      status: message.status,
                      throttled: message.throttled,
                  }
        );
    }
};

export const loadExchangePage = (pluginApi: PluginAPI) => {
    addUiMessageHandler(pluginApi, handleMessage);
    requested = true;
    postToUi(pluginApi, { type: TYPE_LOAD_EXCHANGE_PAGE, url: EXCHANGE_PAGE_URL });
};

export const exchangePageInfo = (): ExchangePageInfo | undefined => page;

export const resetExchangePage = () => {
    page = undefined;
    requested = false;
    nextNonce = 0;
    waiters.clear();
};

const requestFromPage = (
    pluginApi: PluginAPI,
    fields: Record<string, unknown>
): Promise<ExchangeReply> =>
    new Promise<ExchangeReply>((resolve) => {
        addUiMessageHandler(pluginApi, handleMessage);
        if (!requested) {
            loadExchangePage(pluginApi);
        }

        const nonce = ++nextNonce;
        const timer = setTimeout(() => {
            waiters.delete(nonce);
            authLog("the exchange page did not answer", { ms: EXCHANGE_TIMEOUT_MS });
            resolve({
                ok: false,
                reason: page ? "unreachable" : "blocked",
                error:
                    `the exchange page at ${EXCHANGE_PAGE_URL} did not answer` +
                    (page ? "" : " and never loaded") +
                    `. A plugin realm cannot perform the exchange itself, so there is ` +
                    `nowhere else to do it.`,
            });
        }, EXCHANGE_TIMEOUT_MS);

        waiters.set(nonce, (reply) => {
            clearTimeout(timer);
            resolve(reply);
        });

        postToUi(pluginApi, { type: TYPE_EXCHANGE_REQUEST, nonce, ...fields });
    });

export const exchangeViaPage = (
    pluginApi: PluginAPI,
    code: string,
    verifier: string
): Promise<ExchangeReply> => requestFromPage(pluginApi, { code, verifier });

export const refreshViaPage = (
    pluginApi: PluginAPI,
    refreshToken: string
): Promise<ExchangeReply> =>
    requestFromPage(pluginApi, { grant: "refresh", refresh_token: refreshToken });
