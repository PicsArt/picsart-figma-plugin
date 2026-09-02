import {
    EXCHANGE_PAGE_READY_TIMEOUT_MS,
    TYPE_EXCHANGE_PAGE_READY,
    TYPE_EXCHANGE_RESULT,
} from "@constants/index";
import { sendMessageToSandBox } from "@api/index";

const PAGE_PREFIX = "picsart-auth-";
const PAGE_READY = "picsart-auth-ready";
const PAGE_RESULT = "picsart-auth-result";
const PAGE_REQUEST = "picsart-auth-exchange";

let frame: HTMLIFrameElement | undefined;
let frameOrigin: string | undefined;
let announced = false;

export const isExchangePageMessage = (data: unknown): boolean =>
    !!data &&
    typeof data === "object" &&
    !("pluginMessage" in (data as Record<string, unknown>)) &&
    typeof (data as { type?: unknown }).type === "string" &&
    (data as { type: string }).type.indexOf(PAGE_PREFIX) === 0;

export const loadExchangePage = (url: string): void => {
    if (frame) return;
    try {
        frameOrigin = new URL(url).origin;
    } catch {
        frameOrigin = undefined;
    }

    const element = document.createElement("iframe");
    element.setAttribute("title", "Picsart sign-in");
    element.setAttribute("aria-hidden", "true");
    element.style.display = "none";
    element.src = url;
    document.body.appendChild(element);
    frame = element;

    setTimeout(() => {
        if (announced) return;
        console.error(
            `The Picsart sign-in page at ${url} did not answer within ` +
                `${EXCHANGE_PAGE_READY_TIMEOUT_MS}ms. Signing in cannot complete: a plugin ` +
                `cannot perform the token exchange itself.`
        );
    }, EXCHANGE_PAGE_READY_TIMEOUT_MS);
};

export const forwardFromExchangePage = (event: MessageEvent): void => {
    if (frameOrigin && event.origin !== frameOrigin) return;
    const message = event.data as Record<string, unknown>;

    if (message.type === PAGE_READY) {
        announced = true;
        sendMessageToSandBox(true, "", TYPE_EXCHANGE_PAGE_READY, undefined, {
            clientId: message.clientId,
            redirectUri: message.redirectUri,
            pageOrigin: message.origin,
            secureContext: message.secureContext,
        });
        return;
    }

    if (message.type === PAGE_RESULT) {
        sendMessageToSandBox(true, "", TYPE_EXCHANGE_RESULT, undefined, {
            nonce: message.nonce,
            ok: !!message.ok,
            error: message.error,
            status: message.status,
            throttled: message.throttled,
            access_token: message.access_token,
            id_token: message.id_token,
            refresh_token: message.refresh_token,
            expires_in: message.expires_in,
            scope: message.scope,
        });
    }
};

export const requestExchange = (nonce: number, code: string, verifier: string): void => {
    if (!frame?.contentWindow) {
        sendMessageToSandBox(true, "", TYPE_EXCHANGE_RESULT, undefined, {
            nonce,
            ok: false,
            error: "the Picsart sign-in page is not loaded, so the code cannot be exchanged",
        });
        return;
    }
    frame.contentWindow.postMessage(
        { type: PAGE_REQUEST, nonce, code, verifier },
        frameOrigin ?? "*"
    );
};

export const resetExchangeFrame = (): void => {
    frame = undefined;
    frameOrigin = undefined;
    announced = false;
};
