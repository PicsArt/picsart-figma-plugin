import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_END_SESSION, OAUTH_CLIENT_ID } from "../../constants/index";
import { endSession, tokenFromBody } from "../oauthClient";
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
    scope: ["profile", "workflows.execute"],
    exp: EXP_SECONDS,
    sub: "392204481019101",
});
const DESCOPED_TOKEN = jwt({ scope: ["profile"], exp: EXP_SECONDS });

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

afterEach(() => vi.restoreAllMocks());

describe("tokenFromBody", () => {
    it("builds a record from the token, preferring the token's own exp over expires_in", () => {
        const body = {
            access_token: GOOD_TOKEN,
            refresh_token: "rt:abc",
            expires_in: 3599,
            id_token: jwt({ name: "Ada Lovelace", sub: "1" }),
        };

        const result = tokenFromBody(body, "test");

        expect(result).toMatchObject({
            ok: true,
            name: "Ada Lovelace",
            record: {
                accessToken: GOOD_TOKEN,
                refreshToken: "rt:abc",
                expiresAt: EXP_SECONDS * 1000,
                scopes: ["profile", "workflows.execute"],
                clientId: OAUTH_CLIENT_ID,
            },
        });
    });

    it("records the GRANTED scopes, never the requested ones", () => {
        const body = { access_token: GOOD_TOKEN };

        const result = tokenFromBody(body, "test");

        expect(result.ok && result.record.scopes).toEqual(["profile", "workflows.execute"]);
    });

    it("refuses a token missing a required scope, before anything is spent (task S4)", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const body = { access_token: DESCOPED_TOKEN };

        const result = tokenFromBody(body, "test");

        expect(result).toEqual({
            ok: false,
            reason: "scope",
            missing: ["workflows.execute"],
        });
    });

    it("refuses a token it cannot decode", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const body = { access_token: "rt:not-a-jwt" };

        const result = tokenFromBody(body, "test");

        expect(result).toMatchObject({ ok: false, reason: "scope" });
    });

    it("treats a 200 with no access_token as malformed rather than as success", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const body = { token_type: "Bearer" };

        expect(tokenFromBody(body, "test")).toEqual({
            ok: false,
            reason: "malformed",
        });
    });

    it("records the client that issued the token, for a later refresh", () => {
        const result = tokenFromBody({ access_token: GOOD_TOKEN }, "test", "dcr-earlier");

        expect(result.ok && result.record.clientId).toBe("dcr-earlier");
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
