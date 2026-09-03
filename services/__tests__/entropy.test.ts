import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    EntropyUnavailableError,
    NoSecureRandomError,
    localRandomBytes,
    requestEntropyFromUi,
    secureRandomBytes,
} from "../entropy";
import { beginUiSession, resetUiBridge } from "../UiBridge";
import { ENTROPY_TIMEOUT_MS, TYPE_RANDOM_RESULT, TYPE_REQUEST_RANDOM } from "../../constants/index";

interface Posted {
    type?: string;
    [key: string]: unknown;
}

const makeApi = () => {
    const posted: Posted[] = [];
    const api = {
        ui: {
            postMessage: (msg: Posted) => posted.push(msg),
            onmessage: undefined as unknown,
        },
    } as unknown as PluginAPI;
    return { api, posted };
};

const replyFromUi = (api: PluginAPI, message: Posted) =>
    (api.ui.onmessage as (m: Posted) => unknown)(message);

const ready = (api: PluginAPI) => replyFromUi(api, { type: "ui-ready" });

describe("localRandomBytes", () => {
    it("returns bytes in a realm that has a CSPRNG", () => {
        const bytes = localRandomBytes(32);
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes).toHaveLength(32);
    });

    it("returns undefined — NOT weaker bytes — in a realm that has none", () => {
        vi.stubGlobal("crypto", undefined);
        try {
            expect(localRandomBytes(32)).toBeUndefined();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe("requestEntropyFromUi", () => {
    beforeEach(() => resetUiBridge());
    afterEach(() => {
        vi.useRealTimers();
        resetUiBridge();
    });

    it("asks the panel and resolves with what comes back", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 4);

        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        expect(request).toBeDefined();
        expect(request?.length).toBe(4);

        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: new Uint8Array([1, 2, 3, 4]),
        });

        expect(Array.from(await pending)).toEqual([1, 2, 3, 4]);
    });

    it("accepts a plain array, because a structured clone may hand back either", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 4);
        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: [9, 8, 7, 6],
        });

        expect(Array.from(await pending)).toEqual([9, 8, 7, 6]);
    });

    it("ignores a reply carrying another request's id", async () => {
        vi.useFakeTimers();
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 4);
        const settled = vi.fn();
        pending.then(settled, settled);

        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: "entropy-someone-else",
            bytes: new Uint8Array([1, 2, 3, 4]),
        });
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();

        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: new Uint8Array([5, 6, 7, 8]),
        });
        expect(Array.from(await pending)).toEqual([5, 6, 7, 8]);
    });

    it("refuses terminally when the PANEL reports it has no crypto either", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 32);
        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: null,
            reason: "no-crypto",
        });

        await expect(pending).rejects.toBeInstanceOf(NoSecureRandomError);
    });

    it("treats a silent panel as retryable, not as a realm with no randomness", async () => {
        vi.useFakeTimers();
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 32);
        const caught = pending.catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(ENTROPY_TIMEOUT_MS + 1);

        const error = await caught;
        expect(error).toBeInstanceOf(EntropyUnavailableError);
        expect(error).not.toBeInstanceOf(NoSecureRandomError);
    });

    it("refuses a short answer rather than deriving a verifier from fewer bytes", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const pending = requestEntropyFromUi(api, 32);
        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: new Uint8Array(8),
        });

        await expect(pending).rejects.toBeInstanceOf(EntropyUnavailableError);
    });

    it("queues the request when the panel has not mounted yet", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);

        const pending = requestEntropyFromUi(api, 4);
        expect(posted).toHaveLength(0);

        ready(api);
        const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
        expect(request).toBeDefined();

        replyFromUi(api, {
            type: TYPE_RANDOM_RESULT,
            requestId: request?.requestId,
            bytes: new Uint8Array([4, 3, 2, 1]),
        });
        expect(Array.from(await pending)).toEqual([4, 3, 2, 1]);
    });
});

describe("secureRandomBytes", () => {
    beforeEach(() => resetUiBridge());
    afterEach(() => resetUiBridge());

    it("uses this realm's CSPRNG when it has one, without troubling the panel", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        const bytes = await secureRandomBytes(api, 32);

        expect(bytes).toHaveLength(32);
        expect(posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM)).toBeUndefined();
    });

    it("falls back to the panel when this realm has none — the Figma sandbox case", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        vi.stubGlobal("crypto", undefined);
        try {
            const pending = secureRandomBytes(api, 4);
            const request = posted.find((msg) => msg.type === TYPE_REQUEST_RANDOM);
            expect(request).toBeDefined();
            replyFromUi(api, {
                type: TYPE_RANDOM_RESULT,
                requestId: request?.requestId,
                bytes: new Uint8Array([7, 7, 7, 7]),
            });
            expect(Array.from(await pending)).toEqual([7, 7, 7, 7]);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
