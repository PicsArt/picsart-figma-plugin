import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    API_KEY_NAME,
    OAUTH_RECORD_NAME,
    SESSION_ENDED_ERR,
    SESSION_SCOPE_ERR,
    SIGNED_OUT_MSG,
    SIGNED_OUT_USING_KEY_MSG,
    SIGN_IN_BLOCKED_ERR,
    SIGN_IN_CANCELLED_MSG,
    SIGN_IN_FAILED_ERR,
    SIGN_IN_NOT_REMEMBERED_ERR,
    SIGN_IN_TIMED_OUT_ERR,
    SIGN_IN_UNREACHABLE_ERR,
    DEVICE_POLL_OFFLINE_TOLERANCE,
    OAUTH_CLIENT_ID,
    TYPE_AUTH_STATE,
    TYPE_CREDENTIAL,
} from "../../constants/index";
import type { AuthState } from "../../src/types/auth";
import {
    acknowledgeTerminalAuthState,
    activeCredential,
    authState,
    cancelSignIn,
    hasPendingSignIn,
    postAuthState,
    refreshCredentialNow,
    resetAuthSession,
    signOut,
    startSignIn,
} from "../authSession";
import type { SandboxFetchFn } from "../sandboxFetch";
import { beginUiSession, resetUiBridge } from "../UiBridge";
import {
    makeFigmaStub,
    type ExchangeRequest,
    type ExchangeStubReply,
    type FigmaStub,
} from "./figmaStub";

const jwt = (claims: Record<string, unknown>): string => {
    const encode = (value: unknown) =>
        Buffer.from(JSON.stringify(value))
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    return `${encode({ alg: "RS256" })}.${encode(claims)}.sig`;
};

const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600;
const TOKEN = jwt({ scope: ["profile", "workflows.execute"], exp: FUTURE_EXP });
const DESCOPED = jwt({ scope: ["profile"], exp: FUTURE_EXP });
const KEY = "an-api-key";

const reply = (over: Partial<FetchResponse> = {}): FetchResponse =>
    ({
        ok: true,
        status: 200,
        headersObject: {},
        json: async () => ({}),
        text: async () => "",
        ...over,
    }) as FetchResponse;

const fetchStub = (...responses: FetchResponse[]) => {
    let call = 0;
    return vi.fn<SandboxFetchFn>(async () => responses[Math.min(call++, responses.length - 1)]);
};

const record = (over: Record<string, unknown> = {}) => ({
    accessToken: TOKEN,
    refreshToken: "rt:stored",
    expiresAt: Date.now() + 3_600_000,
    scopes: ["profile", "workflows.execute"],
    clientId: OAUTH_CLIENT_ID,
    writtenAt: 1000,
    ...over,
});


const exchanged = (over: Record<string, unknown> = {}) => ({
    ok: true as const,
    body: { access_token: TOKEN, refresh_token: "rt:new", ...over },
});

const ready = (stub: FigmaStub) => {
    beginUiSession(stub.api);
    (stub.api.ui.onmessage as (m: { type: string }) => unknown)({ type: "ui-ready" });
};

const states = (stub: FigmaStub): AuthState[] =>
    stub.posted.filter((m) => m.type === TYPE_AUTH_STATE).map((m) => m.payload as AuthState);

const lastState = (stub: FigmaStub): AuthState | undefined => states(stub).at(-1);

const VERIFICATION_URI = "https://accounts.picsart.com/device";
const VERIFICATION_URI_COMPLETE = `${VERIFICATION_URI}?user_code=WDJB-MJHT`;

// A one-millisecond interval, so a poll loop runs to its end under real timers.
const deviceCodes = (over: Record<string, unknown> = {}): ExchangeStubReply => ({
    ok: true,
    body: {
        device_code: "dc:abc",
        user_code: "WDJB-MJHT",
        verification_uri: VERIFICATION_URI,
        verification_uri_complete: VERIFICATION_URI_COMPLETE,
        expires_in: 300,
        interval: 0.001,
        ...over,
    },
});

const pollError = (oauthError: string): ExchangeStubReply => ({
    ok: false,
    status: 400,
    error: `auth request failed: HTTP 400 {"error":"${oauthError}"}`,
    oauth_error: oauthError,
});

const PENDING = pollError("authorization_pending");

/**
 * Answers the exchange page by grant: the device authorization, then each poll in
 * turn (the last one repeating), and any refresh.
 */
const device = (
    polls: ExchangeStubReply[] = [PENDING],
    options: { start?: ExchangeStubReply; refresh?: ExchangeStubReply } = {}
) => {
    const sent: ExchangeRequest[] = [];
    let poll = 0;
    const answer = (msg: ExchangeRequest): ExchangeStubReply => {
        sent.push(msg);
        if (msg.grant === "device_authorization") return options.start ?? deviceCodes();
        if (msg.grant === "device_code") return polls[Math.min(poll++, polls.length - 1)];
        return options.refresh ?? exchanged();
    };
    return Object.assign(answer, {
        sent,
        polls: () => sent.filter((m) => m.grant === "device_code").length,
    });
};

beforeEach(() => {
    resetUiBridge();
    resetAuthSession();

    // Nothing here may reach the network. signOut's end-session call takes an
    // injected fetch; the global is stubbed so a test that omits one cannot.
    vi.stubGlobal("fetch", fetchStub(reply()));

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
    resetUiBridge();
    resetAuthSession();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("startSignIn", () => {
    it("asks for a device code, shows the user code and opens the verification page", async () => {
        const exchange = device();
        const stub = makeFigmaStub({ exchange });
        ready(stub);

        await startSignIn(stub.api);

        expect(states(stub).map((s) => s.status)).toEqual(["starting", "awaiting"]);
        expect(lastState(stub)).toMatchObject({
            status: "awaiting",
            userCode: "WDJB-MJHT",
            verificationUri: VERIFICATION_URI,
            verificationUriComplete: VERIFICATION_URI_COMPLETE,
        });
        expect(exchange.sent[0]).toMatchObject({
            grant: "device_authorization",
            scope: "profile workflows.execute",
        });
        expect(stub.opened).toEqual([VERIFICATION_URI_COMPLETE]);
        expect(hasPendingSignIn()).toBe(true);
    });

    it("re-posts the SAME pending flow rather than minting a second code on a second press", async () => {
        const exchange = device();
        const stub = makeFigmaStub({ exchange });
        ready(stub);

        await startSignIn(stub.api);
        await startSignIn(stub.api);

        expect(lastState(stub)).toMatchObject({ status: "awaiting", userCode: "WDJB-MJHT" });
        expect(exchange.sent.filter((m) => m.grant === "device_authorization")).toHaveLength(1);
        expect(stub.opened).toHaveLength(1);
    });

    it("refuses to open a verification page that is not on the accounts site", async () => {
        const stub = makeFigmaStub({
            exchange: device([PENDING], {
                start: deviceCodes({
                    verification_uri: "https://evil.test/device",
                    verification_uri_complete: "https://evil.test/device?user_code=X",
                }),
            }),
        });
        ready(stub);

        await startSignIn(stub.api);

        expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_FAILED_ERR });
        expect(stub.opened).toEqual([]);
        expect(hasPendingSignIn()).toBe(false);
    });

    it("drops only a foreign shortcut link, keeping the plain verification page", async () => {
        const stub = makeFigmaStub({
            exchange: device([PENDING], {
                start: deviceCodes({ verification_uri_complete: "https://evil.test/x" }),
            }),
        });
        ready(stub);

        await startSignIn(stub.api);

        expect(stub.opened).toEqual([VERIFICATION_URI]);
        expect(lastState(stub)).toMatchObject({ status: "awaiting" });
    });

    it("says the plugin was refused, not that the connection is bad, on a CORS block", async () => {
        const stub = makeFigmaStub({
            exchange: device([PENDING], {
                start: { ok: false, error: "not readable from this origin", throttled: true },
            }),
        });
        ready(stub);

        await startSignIn(stub.api);

        expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_BLOCKED_ERR });
    });

    it("does not claim to be reachable when it is not", async () => {
        const stub = makeFigmaStub({
            exchange: device([PENDING], {
                start: { ok: false, error: "could not reach the auth server at all" },
            }),
        });
        ready(stub);

        await startSignIn(stub.api);

        expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_UNREACHABLE_ERR });
    });
});

describe("the device poll", () => {
    it("keeps polling while the person is in the browser, then signs in", async () => {
        const exchange = device([PENDING, PENDING, exchanged()]);
        const stub = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY }, exchange });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() => expect(lastState(stub)).toMatchObject({ status: "signedIn" }));
        expect(exchange.polls()).toBe(3);
        expect(exchange.sent.at(-1)).toMatchObject({ grant: "device_code", device_code: "dc:abc" });
        expect(lastState(stub)).toMatchObject({ scopes: ["profile", "workflows.execute"] });

        expect(stub.clientStorage.get(OAUTH_RECORD_NAME)).toMatchObject({
            accessToken: TOKEN,
            refreshToken: "rt:new",
            clientId: OAUTH_CLIENT_ID,
        });
        expect(stub.clientStorage.get(API_KEY_NAME)).toBe(KEY);
        const credential = stub.posted.filter((m) => m.type === TYPE_CREDENTIAL).at(-1);
        expect(credential?.payload).toMatchObject({
            credential: { kind: "oauth", token: TOKEN },
            apiKey: KEY,
        });
        expect(hasPendingSignIn()).toBe(false);
    });

    it("adds five seconds to the interval, for good, on slow_down", async () => {
        vi.useFakeTimers();
        try {
            const exchange = device([pollError("slow_down"), PENDING]);
            const stub = makeFigmaStub({
                exchange: (msg) =>
                    msg.grant === "device_authorization"
                        ? (exchange(msg), deviceCodes({ interval: 5 }))
                        : exchange(msg),
            });
            ready(stub);

            await startSignIn(stub.api);
            await vi.advanceTimersByTimeAsync(5000);
            expect(exchange.polls()).toBe(1);

            await vi.advanceTimersByTimeAsync(9999);
            expect(exchange.polls()).toBe(1);
            await vi.advanceTimersByTimeAsync(1);
            expect(exchange.polls()).toBe(2);

            await vi.advanceTimersByTimeAsync(10000);
            expect(exchange.polls()).toBe(3);
        } finally {
            vi.useRealTimers();
        }
    });

    it("shows the denied screen when the person declines", async () => {
        const exchange = device([pollError("access_denied")]);
        const stub = makeFigmaStub({ exchange });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() => expect(lastState(stub)).toEqual({ status: "denied" }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(exchange.polls()).toBe(1);
        expect(hasPendingSignIn()).toBe(false);
    });

    it("says the sign-in timed out when the server expires the device code", async () => {
        const stub = makeFigmaStub({ exchange: device([pollError("expired_token")]) });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() =>
            expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_TIMED_OUT_ERR })
        );
    });

    it("stops at the code's own lifetime without asking the server again", async () => {
        const exchange = device();
        const stub = makeFigmaStub({
            exchange: (msg) =>
                msg.grant === "device_authorization"
                    ? (exchange(msg), deviceCodes({ expires_in: 0.001, interval: 0.01 }))
                    : exchange(msg),
        });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() =>
            expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_TIMED_OUT_ERR })
        );
        expect(exchange.polls()).toBe(0);
    });

    it("fails on a refused device code rather than polling it forever", async () => {
        const exchange = device([pollError("invalid_grant")]);
        const stub = makeFigmaStub({ exchange });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() =>
            expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_FAILED_ERR })
        );
        expect(exchange.polls()).toBe(1);
    });

    it("rides out a few unanswered polls, then gives up and says the network is the problem", async () => {
        const unanswered: ExchangeStubReply = { ok: false, error: "could not reach the auth server" };
        const recovers = device([unanswered, unanswered, exchanged()]);
        const stub = makeFigmaStub({ exchange: recovers });
        ready(stub);

        await startSignIn(stub.api);
        await vi.waitFor(() => expect(lastState(stub)).toMatchObject({ status: "signedIn" }));

        resetAuthSession();
        const dead = device([unanswered]);
        const other = makeFigmaStub({ exchange: dead });
        ready(other);

        await startSignIn(other.api);
        await vi.waitFor(() =>
            expect(lastState(other)).toEqual({ status: "failed", reason: SIGN_IN_UNREACHABLE_ERR })
        );
        expect(dead.polls()).toBe(DEVICE_POLL_OFFLINE_TOLERANCE);
    });

    it("backs off on a readable 429 instead of ending the sign-in", async () => {
        vi.useFakeTimers();
        try {
            const limited: ExchangeStubReply = {
                ok: false,
                status: 429,
                throttled: true,
                error: "the auth server is rate limiting this client (HTTP 429)",
            };
            const exchange = device([limited, exchanged()]);
            const stub = makeFigmaStub({
                exchange: (msg) =>
                    msg.grant === "device_authorization"
                        ? (exchange(msg), deviceCodes({ interval: 5 }))
                        : exchange(msg),
            });
            ready(stub);

            await startSignIn(stub.api);
            await vi.advanceTimersByTimeAsync(5000);
            expect(exchange.polls()).toBe(1);
            expect(lastState(stub)).toMatchObject({ status: "awaiting" });

            await vi.advanceTimersByTimeAsync(9999);
            expect(exchange.polls()).toBe(1);
            await vi.advanceTimersByTimeAsync(1);
            expect(exchange.polls()).toBe(2);
            await vi.waitFor(() => expect(lastState(stub)).toMatchObject({ status: "signedIn" }));
        } finally {
            vi.useRealTimers();
        }
    });

    it("stops polling when the user cancels, so a late approval cannot sign them in anyway", async () => {
        let approve = false;
        const exchange = device();
        const stub = makeFigmaStub({
            exchange: (msg) =>
                msg.grant === "device_code" && approve ? exchanged() : exchange(msg),
        });
        ready(stub);

        await startSignIn(stub.api);
        await cancelSignIn(stub.api);
        approve = true;

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(lastState(stub)).toEqual({ status: "idle" });
        expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
    });

    it("reports a descoped token as a scope failure, and stores nothing", async () => {
        const stub = makeFigmaStub({
            exchange: device([{ ok: true, body: { access_token: DESCOPED } }]),
        });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() =>
            expect(lastState(stub)).toEqual({ status: "failed", reason: SESSION_SCOPE_ERR })
        );
        expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
    });

    it("says the session will not survive a relaunch when the write fails", async () => {
        const stub = makeFigmaStub({ storageFails: { set: true }, exchange: device([exchanged()]) });
        ready(stub);

        await startSignIn(stub.api);

        await vi.waitFor(() => expect(lastState(stub)).toMatchObject({ status: "signedIn" }));
        expect(stub.notified).toEqual([{ msg: SIGN_IN_NOT_REMEMBERED_ERR, error: true }]);
        expect(
            stub.posted.filter((m) => m.type === TYPE_CREDENTIAL).at(-1)?.payload
        ).toMatchObject({ credential: { kind: "oauth", token: TOKEN } });
    });
});

describe("cancelSignIn", () => {
    it("is the exit from the case nothing else can end", async () => {
        const stub = makeFigmaStub({ exchange: device() });
        ready(stub);
        await startSignIn(stub.api);

        await cancelSignIn(stub.api);

        expect(lastState(stub)).toEqual({ status: "idle" });
        expect(hasPendingSignIn()).toBe(false);
        expect(stub.notified).toEqual([{ msg: SIGN_IN_CANCELLED_MSG, error: false }]);
    });

    it("says nothing when there was nothing to cancel", async () => {
        const stub = makeFigmaStub();
        ready(stub);

        await cancelSignIn(stub.api);

        expect(stub.notified).toEqual([]);
        expect(lastState(stub)).toEqual({ status: "idle" });
    });
});

describe("activeCredential", () => {
    it("returns the API key when that is all there is", async () => {
        const stub = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

        expect(await activeCredential(stub.api)).toEqual({
            credential: { kind: "apikey", token: KEY },
            apiKey: KEY,
        });
    });

    it("returns nothing at all when there is neither", async () => {
        const stub = makeFigmaStub({ clientStorage: {} });
        expect(await activeCredential(stub.api)).toEqual({ credential: null, apiKey: "" });
    });

    it("prefers OAuth over a retained key (decision D4)", async () => {
        const stub = makeFigmaStub({
            clientStorage: { [API_KEY_NAME]: KEY, [OAUTH_RECORD_NAME]: record() },
        });

        const active = await activeCredential(stub.api);

        expect(active.credential).toMatchObject({ kind: "oauth", token: TOKEN });
        expect(active.apiKey).toBe(KEY);
    });

    it("resolves a rejected storage read to no credential rather than throwing", async () => {
        const stub = makeFigmaStub({ storageFails: { get: true } });
        expect(await activeCredential(stub.api)).toEqual({ credential: null, apiKey: "" });
    });

    describe("when the access token has expired", () => {
        const expired = { [OAUTH_RECORD_NAME]: record({ expiresAt: Date.now() - 1000 }) };

        it("refreshes and adopts the new token", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: exchanged(),
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(active.credential).toMatchObject({ kind: "oauth", token: TOKEN });
            expect(stub.clientStorage.get(OAUTH_RECORD_NAME)).toMatchObject({
                refreshToken: "rt:new",
            });
            expect(authState()).toMatchObject({ status: "signedIn" });
        });

        it("refreshes for the client that issued the session", async () => {
            const exchange = device();
            const stub = makeFigmaStub({ clientStorage: { ...expired }, exchange });
            ready(stub);

            await activeCredential(stub.api);

            expect(exchange.sent).toEqual([
                expect.objectContaining({
                    grant: "refresh",
                    refresh_token: "rt:stored",
                    client_id: OAUTH_CLIENT_ID,
                }),
            ]);
        });

        it("keeps refreshing a session from the earlier client under that client", async () => {
            const legacy = "dcr-1e37e9dd-0f8d-4927-800b-b0eac86b62f8";
            const exchange = device();
            const stub = makeFigmaStub({
                clientStorage: {
                    [OAUTH_RECORD_NAME]: record({ expiresAt: Date.now() - 1000, clientId: legacy }),
                },
                exchange,
            });
            ready(stub);

            await activeCredential(stub.api);

            expect(exchange.sent[0]).toMatchObject({ grant: "refresh", client_id: legacy });
            expect(stub.clientStorage.get(OAUTH_RECORD_NAME)).toMatchObject({ clientId: legacy });
        });

        it("keeps the stored refresh token when the server issues no new one", async () => {
            // RFC 6749 section 6: a new refresh token is optional on a refresh. Taking
            // the response literally drops the one that still works, and the session
            // then dies at the NEXT expiry with "your session has ended".
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: exchanged({ refresh_token: undefined }),
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(active.credential).toMatchObject({ kind: "oauth", token: TOKEN });
            expect(stub.clientStorage.get(OAUTH_RECORD_NAME)).toMatchObject({
                refreshToken: "rt:stored",
            });
        });

        it("refreshes SILENTLY, so a background refresh cannot hijack the panel", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: exchanged(),
            });
            ready(stub);

            await activeCredential(stub.api);

            expect(states(stub)).toEqual([]);
            expect(authState()).toMatchObject({ status: "signedIn" });
        });

        it("still says a terminal failure out loud", async () => {
            const stub = makeFigmaStub({
                clientStorage: {
                    [OAUTH_RECORD_NAME]: record({
                        expiresAt: Date.now() - 1000,
                        refreshToken: undefined,
                    }),
                },
            });
            ready(stub);

            await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({ status: "failed", reason: SESSION_ENDED_ERR });
        });

        it("does not overwrite a sign-in the user has on screen", async () => {
            const stub = makeFigmaStub({
                clientStorage: { [OAUTH_RECORD_NAME]: record() },
                exchange: device(),
            });
            ready(stub);
            await startSignIn(stub.api);

            await activeCredential(stub.api);

            expect(authState().status).toBe("awaiting");
        });

        it("collapses two concurrent callers into ONE refresh", async () => {
            let requests = 0;
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: () => {
                    requests++;
                    return exchanged();
                },
            });
            ready(stub);

            const [a, b] = await Promise.all([
                activeCredential(stub.api),
                activeCredential(stub.api),
            ]);

            expect(requests).toBe(1);
            expect(a.credential).toMatchObject({ kind: "oauth" });
            expect(b.credential).toMatchObject({ kind: "oauth" });
        });

        it("adopts another document's rotation instead of signing the user out", async () => {
            const rotated = record({ writtenAt: 9999, accessToken: TOKEN });
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: () => {
                    stub.clientStorage.set(OAUTH_RECORD_NAME, rotated);
                    return {
                        ok: false as const,
                        status: 400,
                        error: 'token exchange failed: HTTP 400 {"error":"invalid_grant"}',
                    };
                },
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(active.credential).toMatchObject({ kind: "oauth", token: TOKEN });
            expect(authState()).toMatchObject({ status: "signedIn" });
            expect(stub.clientStorage.get(OAUTH_RECORD_NAME)).toBe(rotated);
        });

        it("ends the session on an invalid_grant that storage still agrees with", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired, [API_KEY_NAME]: KEY },
                exchange: pollError("invalid_grant"),
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({ status: "failed", reason: SESSION_ENDED_ERR });
            expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
            expect(active.credential).toEqual({ kind: "apikey", token: KEY });
        });

        it("KEEPS the record when the refresh is blocked, and says which it was", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: { ok: false, error: "the reply was not readable", throttled: true },
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({ status: "failed", reason: SIGN_IN_BLOCKED_ERR });
            expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(true);
            expect(active.credential).toBeNull();
        });

        it("KEEPS the record when the refresh could not reach a server", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: { ok: false, error: "could not reach the token endpoint at all" },
            });
            ready(stub);

            const active = await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({
                status: "failed",
                reason: SIGN_IN_UNREACHABLE_ERR,
            });
            expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(true);
            expect(active.credential).toBeNull();
        });

        it("ends the session, out loud, when there is no refresh token behind it", async () => {
            const stub = makeFigmaStub({
                clientStorage: {
                    [OAUTH_RECORD_NAME]: record({
                        expiresAt: Date.now() - 1000,
                        refreshToken: undefined,
                    }),
                },
            });
            ready(stub);

            await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({ status: "failed", reason: SESSION_ENDED_ERR });
            expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
        });

        it("clears a session whose refresh came back missing a scope", async () => {
            const stub = makeFigmaStub({
                clientStorage: { ...expired },
                exchange: { ok: true, body: { access_token: DESCOPED } },
            });
            ready(stub);

            await activeCredential(stub.api);

            expect(lastState(stub)).toEqual({ status: "failed", reason: SESSION_SCOPE_ERR });
            expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
        });
    });
});

describe("refreshCredentialNow", () => {
    it("refreshes even when the local clock thinks the token is fine", async () => {
        let requests = 0;
        const stub = makeFigmaStub({
            clientStorage: { [OAUTH_RECORD_NAME]: record() },
            exchange: () => {
                requests++;
                return exchanged();
            },
        });
        ready(stub);

        const active = await refreshCredentialNow(stub.api);

        expect(requests).toBe(1);
        expect(active.credential).toMatchObject({ kind: "oauth" });
        expect(states(stub)).toEqual([]);
    });

    it("answers with the API key when there is no session to refresh", async () => {
        let requests = 0;
        const stub = makeFigmaStub({
            clientStorage: { [API_KEY_NAME]: KEY },
            exchange: () => {
                requests++;
                return exchanged();
            },
        });

        expect(await refreshCredentialNow(stub.api)).toEqual({
            credential: { kind: "apikey", token: KEY },
            apiKey: KEY,
        });
        expect(requests).toBe(0);
    });
});

describe("signOut", () => {
    it("clears locally first, then tells the user which pool is spending now", async () => {
        const stub = makeFigmaStub({
            clientStorage: { [API_KEY_NAME]: KEY, [OAUTH_RECORD_NAME]: record() },
        });
        ready(stub);

        const active = await signOut(stub.api, fetchStub(reply()));

        expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
        expect(stub.clientStorage.get(API_KEY_NAME)).toBe(KEY);
        expect(active.credential).toEqual({ kind: "apikey", token: KEY });
        expect(stub.notified).toEqual([{ msg: SIGNED_OUT_USING_KEY_MSG, error: false }]);
        expect(lastState(stub)).toEqual({ status: "idle" });
    });

    it("says something different when there is no key to fall back to", async () => {
        const stub = makeFigmaStub({ clientStorage: { [OAUTH_RECORD_NAME]: record() } });
        ready(stub);

        const active = await signOut(stub.api, fetchStub(reply()));

        expect(active.credential).toBeNull();
        expect(stub.notified).toEqual([{ msg: SIGNED_OUT_MSG, error: false }]);
    });

    it("signs the user out locally even when the server refuses", async () => {
        const stub = makeFigmaStub({ clientStorage: { [OAUTH_RECORD_NAME]: record() } });
        ready(stub);

        await signOut(stub.api, fetchStub(reply({ ok: false, status: 401 })));

        expect(stub.clientStorage.has(OAUTH_RECORD_NAME)).toBe(false);
        expect(lastState(stub)).toEqual({ status: "idle" });
    });
});

describe("postAuthState", () => {
    it("replays a pending sign-in into a new session (task A13)", async () => {
        const stub = makeFigmaStub({ exchange: device() });
        ready(stub);
        await startSignIn(stub.api);

        const fresh = makeFigmaStub();
        resetUiBridge();
        ready(fresh);
        postAuthState(fresh.api);

        expect(lastState(fresh)).toMatchObject({ status: "awaiting", userCode: "WDJB-MJHT" });
        expect(authState().status).toBe("awaiting");
    });

    it("replays a terminal failure faithfully until it is acknowledged", async () => {
        const stub = makeFigmaStub();
        ready(stub);
        await startSignIn(stub.api);
        expect(authState().status).toBe("failed");

        const fresh = makeFigmaStub();
        resetUiBridge();
        ready(fresh);
        postAuthState(fresh.api);

        expect(lastState(fresh)).toMatchObject({ status: "failed" });
    });

    it("stops replaying once the user has navigated away", async () => {
        const stub = makeFigmaStub();
        ready(stub);
        await startSignIn(stub.api);

        acknowledgeTerminalAuthState();

        expect(authState()).toEqual({ status: "idle" });
    });

    it("does NOT acknowledge a pending sign-in away, which is what A13 protects", async () => {
        const stub = makeFigmaStub({ exchange: device() });
        ready(stub);
        await startSignIn(stub.api);

        acknowledgeTerminalAuthState();

        expect(authState().status).toBe("awaiting");
        expect(hasPendingSignIn()).toBe(true);
    });

    it("does not downgrade a signed-in state", async () => {
        const stub = makeFigmaStub({ exchange: device([exchanged()]) });
        ready(stub);
        await startSignIn(stub.api);
        await vi.waitFor(() => expect(authState().status).toBe("signedIn"));

        postAuthState(stub.api);
        expect(authState().status).toBe("signedIn");
    });
});
