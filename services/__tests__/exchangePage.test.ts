import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    exchangePageInfo,
    loadExchangePage,
    pollDeviceViaPage,
    refreshViaPage,
    resetExchangePage,
    startDeviceViaPage,
} from "../exchangePage";
import { beginUiSession, resetUiBridge } from "../UiBridge";
import {
    EXCHANGE_PAGE_URL,
    EXCHANGE_TIMEOUT_MS,
    OAUTH_CLIENT_ID,
    TYPE_EXCHANGE_PAGE_READY,
    TYPE_EXCHANGE_REQUEST,
    TYPE_EXCHANGE_RESULT,
    TYPE_LOAD_EXCHANGE_PAGE,
} from "../../constants/index";

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

const fromUi = (api: PluginAPI, message: Posted) =>
    (api.ui.onmessage as (m: Posted) => unknown)(message);

const ready = (api: PluginAPI) => fromUi(api, { type: "ui-ready" });

const announce = (api: PluginAPI, over: Posted = {}) =>
    fromUi(api, {
        type: TYPE_EXCHANGE_PAGE_READY,
        clientId: "dcr-1e37e9dd-0f8d-4927-800b-b0eac86b62f8",
        deviceClientId: OAUTH_CLIENT_ID,
        grants: ["authorization_code", "refresh", "device_authorization", "device_code"],
        pageOrigin: "https://api.picsart.io",
        secureContext: true,
        ...over,
    });

beforeEach(() => {
    resetUiBridge();
    resetExchangePage();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.useRealTimers();
    resetUiBridge();
    resetExchangePage();
    vi.restoreAllMocks();
});

describe("loadExchangePage", () => {
    it("asks the panel to frame the deployed page", () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);

        loadExchangePage(api);

        expect(posted).toContainEqual({
            type: TYPE_LOAD_EXCHANGE_PAGE,
            url: EXCHANGE_PAGE_URL,
        });
    });

    it("records what the page says it is pinned to", () => {
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);

        announce(api);

        expect(exchangePageInfo()).toMatchObject({
            deviceClientId: OAUTH_CLIENT_ID,
            grants: expect.arrayContaining(["device_code"]),
        });
    });

    it("logs deploy skew, because the alternative surfaces as invalid_grant much later", () => {
        const logged = console.error as unknown as ReturnType<typeof vi.fn>;
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);

        announce(api, { deviceClientId: "dcr-somebody-elses" });

        const said = logged.mock.calls.map((call) => String(call[0])).join(" ");
        expect(said).toContain("different client");
    });

    it("says so when the deployed page predates the device grant", () => {
        const logged = console.error as unknown as ReturnType<typeof vi.fn>;
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);

        announce(api, { deviceClientId: undefined, grants: undefined });

        const said = logged.mock.calls.map((call) => String(call[0])).join(" ");
        expect(said).toContain("predates the device grant");
    });
});

describe("requests through the page", () => {
    it("asks for a device code and resolves with what the auth server issued", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = startDeviceViaPage(api, "profile workflows.execute");

        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        expect(request).toMatchObject({
            grant: "device_authorization",
            scope: "profile workflows.execute",
        });
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: true,
            device_code: "dc:abc",
            user_code: "WDJB-MJHT",
            interval: 5,
        });

        await expect(pending).resolves.toMatchObject({
            ok: true,
            device_code: "dc:abc",
            user_code: "WDJB-MJHT",
            interval: 5,
        });
    });

    it("polls with the device code and resolves with the token body", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");

        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        expect(request).toMatchObject({ grant: "device_code", device_code: "dc:abc" });
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: true,
            access_token: "at",
            refresh_token: "rt",
        });

        await expect(pending).resolves.toMatchObject({ ok: true, access_token: "at" });
    });

    it("carries the auth server's error code, so a pending poll is not read as a failure", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: false,
            status: 400,
            oauth_error: "authorization_pending",
            error: 'auth request failed: HTTP 400 {"error":"authorization_pending"}',
        });

        await expect(pending).resolves.toMatchObject({
            ok: false,
            reason: "http",
            oauthError: "authorization_pending",
        });
    });

    it("hands a refresh token down under its own grant", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = refreshViaPage(api, "rt:stored");

        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        expect(request).toMatchObject({
            grant: "refresh",
            refresh_token: "rt:stored",
            client_id: OAUTH_CLIENT_ID,
        });

        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: true,
            access_token: "at:new",
            refresh_token: "rt:rotated",
        });

        await expect(pending).resolves.toMatchObject({
            ok: true,
            access_token: "at:new",
            refresh_token: "rt:rotated",
        });
    });

    it("gives the two grants separate nonces, so neither resolves with the other's token", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const poll = pollDeviceViaPage(api, "dc:abc");
        const refresh = refreshViaPage(api, "rt:stored");

        const requests = posted.filter((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        expect(requests).toHaveLength(2);
        expect(requests[0].nonce).not.toBe(requests[1].nonce);

        fromUi(api, { type: TYPE_EXCHANGE_RESULT, nonce: requests[1].nonce, ok: true, access_token: "from-refresh" });
        fromUi(api, { type: TYPE_EXCHANGE_RESULT, nonce: requests[0].nonce, ok: true, access_token: "from-poll" });

        await expect(poll).resolves.toMatchObject({ access_token: "from-poll" });
        await expect(refresh).resolves.toMatchObject({ access_token: "from-refresh" });
    });

    it("ignores a reply carrying another request's nonce", async () => {
        vi.useFakeTimers();
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        const settled = vi.fn();
        void pending.then(settled);

        fromUi(api, { type: TYPE_EXCHANGE_RESULT, nonce: 9999, ok: true, access_token: "wrong" });
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();

        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: true,
            access_token: "right",
        });
        await expect(pending).resolves.toMatchObject({ access_token: "right" });
    });

    it("classifies an answered-but-unreadable reply as blocked, not as a bad connection", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: false,
            throttled: true,
            error: "not readable",
        });

        await expect(pending).resolves.toMatchObject({ ok: false, reason: "blocked" });
    });

    it("classifies a reply with a status as an HTTP failure", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: false,
            status: 400,
            oauth_error: "invalid_grant",
            error: 'auth request failed: HTTP 400 {"error":"invalid_grant"}',
        });

        await expect(pending).resolves.toMatchObject({ reason: "invalid_grant" });
    });

    it("classifies nothing-answered as unreachable", async () => {
        const { api, posted } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        const request = posted.find((msg) => msg.type === TYPE_EXCHANGE_REQUEST);
        fromUi(api, {
            type: TYPE_EXCHANGE_RESULT,
            nonce: request?.nonce,
            ok: false,
            error: "could not reach the token endpoint at all",
        });

        await expect(pending).resolves.toMatchObject({ reason: "unreachable" });
    });

    it("gives up rather than spinning when the page never answers", async () => {
        vi.useFakeTimers();
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        await vi.advanceTimersByTimeAsync(EXCHANGE_TIMEOUT_MS + 1);

        await expect(pending).resolves.toMatchObject({ ok: false, reason: "unreachable" });
    });

    it("blames the page, not the user's connection, when it never loaded at all", async () => {
        vi.useFakeTimers();
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);

        const pending = pollDeviceViaPage(api, "dc:abc");
        await vi.advanceTimersByTimeAsync(EXCHANGE_TIMEOUT_MS + 1);

        await expect(pending).resolves.toMatchObject({ ok: false, reason: "blocked" });
    });

    it("still works after a tab switch cleared the bridge's handlers", async () => {
        const { api } = makeApi();
        beginUiSession(api);
        ready(api);
        loadExchangePage(api);
        announce(api);

        beginUiSession(api);
        ready(api);

        const pending = pollDeviceViaPage(api, "dc:abc");

        fromUi(api, { type: TYPE_EXCHANGE_RESULT, nonce: 1, ok: true, access_token: "at" });

        await expect(pending).resolves.toMatchObject({ ok: true });
    });
});
