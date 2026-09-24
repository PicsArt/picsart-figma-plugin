import { ENTROPY_TIMEOUT_MS, TYPE_RANDOM_RESULT, TYPE_REQUEST_RANDOM } from "@constants/index";
import { authLog } from "./authLog";
import { addUiMessageHandler, postToUi, removeUiMessageHandler } from "./UiBridge";

export class NoSecureRandomError extends Error {
    constructor() {
        super("crypto.getRandomValues is unavailable in either realm");
        this.name = "NoSecureRandomError";
    }
}

export class EntropyUnavailableError extends Error {
    constructor(reason: string) {
        super(reason);
        this.name = "EntropyUnavailableError";
    }
}

export type RandomSource = (length: number) => Promise<Uint8Array>;

export const localRandomBytes = (length: number): Uint8Array | undefined => {
    if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
        return undefined;
    }
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
};

const asBytes = (value: unknown): Uint8Array | undefined => {
    if (value instanceof Uint8Array) return value;
    if (Array.isArray(value) && value.every((n) => typeof n === "number")) {
        return new Uint8Array(value as number[]);
    }
    return undefined;
};

let nextRequestId = 0;

export const requestEntropyFromUi = (
    pluginApi: PluginAPI,
    length: number
): Promise<Uint8Array> =>
    new Promise<Uint8Array>((resolve, reject) => {
        const requestId = `entropy-${++nextRequestId}`;
        let settled = false;

        const handler = (message: { type?: string; [key: string]: unknown }) => {
            if (!message || message.type !== TYPE_RANDOM_RESULT) return;
            if (message.requestId !== requestId) return;
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            removeUiMessageHandler(handler);

            const bytes = asBytes(message.bytes);
            if (!bytes || bytes.length < length) {
                if (message.reason === "no-crypto") {
                    authLog("the panel has no crypto.getRandomValues either");
                    reject(new NoSecureRandomError());
                    return;
                }
                authLog("the panel supplied no usable randomness", {
                    reason: String(message.reason ?? "unknown"),
                    asked: length,
                    got: bytes ? bytes.length : 0,
                });
                reject(new EntropyUnavailableError("the panel supplied no usable randomness"));
                return;
            }
            resolve(bytes.subarray(0, length));
        };

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            removeUiMessageHandler(handler);
            authLog("the panel did not supply randomness in time", { ms: ENTROPY_TIMEOUT_MS });
            reject(new EntropyUnavailableError("the panel did not supply randomness"));
        }, ENTROPY_TIMEOUT_MS);

        addUiMessageHandler(pluginApi, handler);
        postToUi(pluginApi, { type: TYPE_REQUEST_RANDOM, requestId, length });
    });

export const secureRandomBytes = async (
    pluginApi: PluginAPI,
    length: number
): Promise<Uint8Array> => {
    const local = localRandomBytes(length);
    if (local) return local;
    return requestEntropyFromUi(pluginApi, length);
};

export const randomSourceFor = (pluginApi: PluginAPI): RandomSource => (length) =>
    secureRandomBytes(pluginApi, length);
