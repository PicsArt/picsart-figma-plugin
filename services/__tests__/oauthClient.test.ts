import { afterEach, describe, expect, it, vi } from "vitest";
import {
    AUTH_AUTHORIZE,
    AUTH_END_SESSION,
    AUTH_TOKEN,
    HEADER_PLUGIN_NAME_KEY,
    OAUTH_CLIENT_ID,
    OAUTH_REDIRECT_URI,
} from "../../constants/index";
import {
    buildAuthorizeUrl,
    endSession,
    exchangeAuthorizationCode,
    refreshAccessToken,
} from "../oauthClient";
import type { SandboxFetchFn } from "../sandboxFetch";

const jwt = (claims: Record<string, unknown>): string => {
    const encode = (value: unknown) =>
        Buffer.from(JSON.stringify(value))
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}.sig`;
};

const EXP_SECONDS = 1893456000;
const GOOD_TOKEN = jwt({
    scope: ["openid", "profile", "workflows.execute"],
    exp: EXP_SECONDS,
    sub: "392204481019101",
});
const DESCOPED_TOKEN = jwt({ scope: ["openid", "profile"], exp: EXP_SECONDS });

const reply = (over: Partial<FetchResponse> = {}): FetchResponse =>
    ({
        ok: true,
        status: 200,
        headersObject: {},
        json: async () => ({}),
        text: async () => "",
        ...over,
    }) as FetchResponse;

const stub = (response: FetchResponse) => vi.fn<SandboxFetchFn>(async () => response);

const bodyOf = (fn: ReturnType<typeof stub>): Record<string, string> => {
    const raw = String(fn.mock.calls.at(-1)?.[1]?.body ?? "");
    const out: Record<string, string> = {};
    for (const pair of raw.split("&")) {
        const [name, value] = pair.split("=");
        out[decodeURIComponent(name)] = decodeURIComponent(value ?? "");
    }
    return out;
};

const headersOf = (fn: ReturnType<typeof stub>): Record<string, string> =>
    (fn.mock.calls.at(-1)?.[1]?.headers ?? {}) as Record<string, string>;

afterEach(() => vi.restoreAllMocks());

describe("buildAuthorizeUrl", () => {
    it("carries every parameter the server needs, and S256 rather than plain", () => {
        const url = buildAuthorizeUrl({ state: "st8", challenge: "ch4l" });

        expect(url.startsWith(`${AUTH_AUTHORIZE}?`)).toBe(true);
        expect(url).toContain("response_type=code");
        expect(url).toContain(`client_id=${OAUTH_CLIENT_ID}`);
        expect(url).toContain(`redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}`);
        expect(url).toContain("state=st8");
        expect(url).toContain("code_challenge=ch4l");
        expect(url).toContain("code_challenge_method=S256");
        expect(url).toContain(`scope=${encodeURIComponent("openid profile workflows.execute")}`);
    });

    it("never sends a client secret", () => {
        expect(buildAuthorizeUrl({ state: "s", challenge: "c" })).not.toContain("secret");
    });
});

describe("exchangeAuthorizationCode", () => {
    it("posts the code, the verifier and the client id as a form, with no secret", async () => {
        const fetchFn = stub(
            reply({ json: async () => ({ access_token: GOOD_TOKEN, expires_in: 3599 }) })
        );

        await exchangeAuthorizationCode({ code: "ac:x", verifier: "v" }, fetchFn);

        expect(fetchFn.mock.calls[0][0]).toBe(AUTH_TOKEN);
        expect(bodyOf(fetchFn)).toEqual({
            grant_type: "authorization_code",
            client_id: OAUTH_CLIENT_ID,
            code: "ac:x",
            redirect_uri: OAUTH_REDIRECT_URI,
            code_verifier: "v",
        });
        expect(bodyOf(fetchFn)).not.toHaveProperty("client_secret");
    });

    it("sends only the CORS-safelisted content type, so the request stays simple", async () => {
        const fetchFn = stub(reply({ json: async () => ({ access_token: GOOD_TOKEN }) }));

        await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn);

        expect(headersOf(fetchFn)).toEqual({
            "Content-Type": "application/x-www-form-urlencoded",
        });
        expect(headersOf(fetchFn)).not.toHaveProperty(HEADER_PLUGIN_NAME_KEY);
    });

    it("builds a record from the token, preferring the token's own exp over expires_in", async () => {
        const fetchFn = stub(
            reply({
                json: async () => ({
                    access_token: GOOD_TOKEN,
                    refresh_token: "rt:abc",
                    expires_in: 3599,
                    id_token: jwt({ name: "Ada Lovelace", sub: "1" }),
                }),
            })
        );

        const result = await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn);

        expect(result).toMatchObject({
            ok: true,
            name: "Ada Lovelace",
            record: {
                accessToken: GOOD_TOKEN,
                refreshToken: "rt:abc",
                expiresAt: EXP_SECONDS * 1000,
                scopes: ["openid", "profile", "workflows.execute"],
                clientId: OAUTH_CLIENT_ID,
            },
        });
    });

    it("records the GRANTED scopes, never the requested ones", async () => {
        const fetchFn = stub(reply({ json: async () => ({ access_token: GOOD_TOKEN }) }));

        const result = await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn);

        expect(result.ok && result.record.scopes).toEqual([
            "openid",
            "profile",
            "workflows.execute",
        ]);
    });

    it("refuses a token missing a required scope, before anything is spent (task S4)", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = stub(reply({ json: async () => ({ access_token: DESCOPED_TOKEN }) }));

        const result = await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn);

        expect(result).toEqual({
            ok: false,
            reason: "scope",
            missing: ["workflows.execute"],
        });
    });

    it("refuses a token it cannot decode", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = stub(reply({ json: async () => ({ access_token: "rt:not-a-jwt" }) }));

        const result = await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn);

        expect(result).toMatchObject({ ok: false, reason: "scope" });
    });

    it("treats a 200 with no access_token as malformed rather than as success", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = stub(reply({ json: async () => ({ token_type: "Bearer" }) }));

        expect(await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn)).toEqual({
            ok: false,
            reason: "malformed",
        });
    });

    it("separates invalid_grant from every other HTTP failure", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = stub(
            reply({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) })
        );

        expect(await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn)).toMatchObject(
            { ok: false, reason: "invalid_grant" }
        );

        const other = stub(
            reply({
                ok: false,
                status: 400,
                json: async () => ({
                    error: "invalid_request",
                    error_description: "code_verifier mismatch",
                }),
            })
        );
        expect(await exchangeAuthorizationCode({ code: "c", verifier: "v" }, other)).toEqual({
            ok: false,
            reason: "http",
            detail: "code_verifier mismatch",
        });
    });

    it("reports a genuinely offline request as unreachable", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = vi.fn<SandboxFetchFn>(async () => {
            throw new Error("Failed to fetch");
        });

        expect(await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn)).toEqual({
            ok: false,
            reason: "unreachable",
        });
    });

    it("reports a CORS block as BLOCKED, not as a connection problem", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = vi.fn<SandboxFetchFn>(async (url: string) => {
            if (url.indexOf("oauth2/token") !== -1) throw new Error("Failed to fetch");
            return reply({ ok: false, status: 401 });
        });

        expect(await exchangeAuthorizationCode({ code: "c", verifier: "v" }, fetchFn)).toEqual({
            ok: false,
            reason: "blocked",
        });
    });

    it("classifies a blocked refresh the same way", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = vi.fn<SandboxFetchFn>(async (url: string) => {
            if (url.indexOf("oauth2/token") !== -1) throw new Error("Failed to fetch");
            return reply({ ok: false, status: 401 });
        });

        expect(await refreshAccessToken({ refreshToken: "rt:x" }, fetchFn)).toEqual({
            ok: false,
            reason: "blocked",
        });
    });
});

describe("refreshAccessToken", () => {
    it("posts the refresh grant with the client id and no secret", async () => {
        const fetchFn = stub(reply({ json: async () => ({ access_token: GOOD_TOKEN }) }));

        await refreshAccessToken({ refreshToken: "rt:old" }, fetchFn);

        expect(bodyOf(fetchFn)).toEqual({
            grant_type: "refresh_token",
            client_id: OAUTH_CLIENT_ID,
            refresh_token: "rt:old",
        });
    });

    it("re-checks the scope on the reissued token, not only at sign-in", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = stub(reply({ json: async () => ({ access_token: DESCOPED_TOKEN }) }));

        expect(await refreshAccessToken({ refreshToken: "rt:old" }, fetchFn)).toMatchObject({
            ok: false,
            reason: "scope",
        });
    });
});

describe("endSession", () => {
    it("calls end_session_endpoint, not oauth2/revoke", async () => {
        const fetchFn = stub(reply());

        await endSession({}, fetchFn);

        expect(String(fetchFn.mock.calls[0][0]).startsWith(AUTH_END_SESSION)).toBe(true);
        expect(String(fetchFn.mock.calls[0][0])).not.toContain("revoke");
        expect(fetchFn.mock.calls[0][1]?.method).toBe("GET");
    });

    it("passes an id_token_hint when there is one, and omits it when there is not", async () => {
        const withHint = stub(reply());
        await endSession({ idToken: "id.tok.en" }, withHint);
        expect(String(withHint.mock.calls[0][0])).toContain("id_token_hint=id.tok.en");

        const without = stub(reply());
        await endSession({}, without);
        expect(String(without.mock.calls[0][0])).not.toContain("id_token_hint");
    });

    it("reports a refusal rather than throwing, because the local sign-out already happened", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect(await endSession({}, stub(reply({ ok: false, status: 401 })))).toBe(false);
        expect(await endSession({}, stub(reply()))).toBe(true);
    });
});
