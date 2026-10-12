import {
    EXCHANGE_PAGE_URL,
    EXCHANGE_TIMEOUT_MS,
    OAUTH_CLIENT_ID,
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
    deviceClientId?: string;
    grants?: string[];
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
          [field: string]: unknown;
      }
    | {
          ok: false;
          reason: TokenFailureReason;
          /** The `error` field of the auth server's JSON body, e.g. `authorization_pending`. */
          oauthError?: string;
          error?: string;
          status?: number;
          throttled?: boolean;
      };

interface IncomingExchangeMessage {
    type?: string;
    nonce?: number;
    ok?: boolean;
    error?: string;
    oauth_error?: string;
    status?: number;
    throttled?: boolean;
    clientId?: string;
    deviceClientId?: string;
    grants?: unknown;
    pageOrigin?: string;
    secureContext?: boolean;
    [key: string]: unknown;
}

const classify = (message: IncomingExchangeMessage): TokenFailureReason => {
    if (typeof message.status === "number" && message.status > 0) {
        const oauthError = message.oauth_error ?? String(message.error ?? "");
        return /invalid_grant/i.test(oauthError) ? "invalid_grant" : "http";
    }
    if (message.throttled) return "blocked";
    return "unreachable";
};

const handleMessage = (message: IncomingExchangeMessage) => {
    if (!message) return;

    if (message.type === TYPE_EXCHANGE_PAGE_READY) {
        page = {
            clientId: message.clientId,
            deviceClientId: message.deviceClientId,
            grants: Array.isArray(message.grants)
                ? message.grants.filter((g): g is string => typeof g === "string")
                : undefined,
            pageOrigin: message.pageOrigin,
            secureContext: message.secureContext,
        };

        if (!page.grants || page.grants.indexOf("device_code") === -1) {
            authLog("the exchange page predates the device grant; signing in cannot work", {
                grants: page.grants,
            });
        } else if (page.deviceClientId !== OAUTH_CLIENT_ID) {
            authLog("the exchange page is pinned to a different client than this build", {
                page: page.deviceClientId,
                plugin: OAUTH_CLIENT_ID,
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

        if (message.ok) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { type, nonce, ok, ...fields } = message;
            waiter({ ...fields, ok: true });
            return;
        }

        waiter({
            ok: false,
            reason: classify(message),
            oauthError: typeof message.oauth_error === "string" ? message.oauth_error : undefined,
            error: message.error,
            status: message.status,
            throttled: message.throttled,
        });
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
                    `. A plugin realm cannot reach the auth server itself, so there is ` +
                    `nowhere else to do it.`,
            });
        }, EXCHANGE_TIMEOUT_MS);

        waiters.set(nonce, (reply) => {
            clearTimeout(timer);
            resolve(reply);
        });

        postToUi(pluginApi, { type: TYPE_EXCHANGE_REQUEST, nonce, ...fields });
    });

export const startDeviceViaPage = (
    pluginApi: PluginAPI,
    scope: string
): Promise<ExchangeReply> => {
    // An older page treats an unknown grant as a code exchange and answers with no
    // status, which would read as the user's network. Say whose problem it is instead.
    if (page && (!page.grants || page.grants.indexOf("device_authorization") === -1)) {
        return Promise.resolve({
            ok: false,
            reason: "blocked",
            error: `the exchange page at ${EXCHANGE_PAGE_URL} predates the device grant`,
        });
    }
    return requestFromPage(pluginApi, { grant: "device_authorization", scope });
};

export const pollDeviceViaPage = (
    pluginApi: PluginAPI,
    deviceCode: string
): Promise<ExchangeReply> =>
    requestFromPage(pluginApi, { grant: "device_code", device_code: deviceCode });

export const refreshViaPage = (
    pluginApi: PluginAPI,
    refreshToken: string,
    clientId: string = OAUTH_CLIENT_ID
): Promise<ExchangeReply> =>
    requestFromPage(pluginApi, {
        grant: "refresh",
        refresh_token: refreshToken,
        client_id: clientId,
    });
