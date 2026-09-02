import { describe, expect, it, vi } from "vitest";
import {
  accessTokenExpiry,
  checkGrantedScopes,
  decodeAccessToken,
  grantedScopes,
} from "../grantedScope";

const segment = (claims: unknown): string =>
  Buffer.from(JSON.stringify(claims), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const jwt = (claims: unknown): string =>
  `${segment({ alg: "RS256", typ: "JWT" })}.${segment(claims)}.c2lnbmF0dXJl`;

describe("decodeAccessToken", () => {
  it("reads the payload claims", () => {
    const token = jwt({ sub: "user-1", client_id: "dcr-x", scope: "openid" });

    expect(decodeAccessToken(token)).toMatchObject({ sub: "user-1", client_id: "dcr-x" });
  });

  it("decodes a multi-byte claim without mangling it", () => {
    expect(decodeAccessToken(jwt({ name: "Ա Բ Գ — Ω" }))).toMatchObject({
      name: "Ա Բ Գ — Ω",
    });
  });

  it("returns null for anything that is not a three-part JWT", () => {
    expect(decodeAccessToken("not-a-jwt")).toBeNull();
    expect(decodeAccessToken("a.b")).toBeNull();
    expect(decodeAccessToken("rt:abcdef")).toBeNull();
  });

  it("returns null rather than throwing on a corrupt payload", () => {
    expect(decodeAccessToken("aaa.!!!not-base64url!!!.ccc")).toBeNull();
    expect(decodeAccessToken(`aaa.${Buffer.from("{oops").toString("base64url")}.ccc`)).toBeNull();
  });

  it("refuses a payload that decodes to something other than an object", () => {
    expect(decodeAccessToken(jwt([1, 2, 3]))).toBeNull();
    expect(decodeAccessToken(jwt("a string"))).toBeNull();
  });
});

describe("grantedScopes", () => {
  it("reads the space-delimited form RFC 8693 specifies", () => {
    expect(grantedScopes(jwt({ scope: "openid profile workflows.execute" }))).toEqual([
      "openid",
      "profile",
      "workflows.execute",
    ]);
  });

  it("reads the array form this server actually returns", () => {
    expect(grantedScopes(jwt({ scope: ["openid", "workflows.execute"] }))).toEqual([
      "openid",
      "workflows.execute",
    ]);
  });

  it("is empty for a token with no scope claim, not undefined", () => {
    expect(grantedScopes(jwt({ sub: "x" }))).toEqual([]);
  });
});

describe("accessTokenExpiry", () => {
  it("converts exp from seconds to milliseconds", () => {
    expect(accessTokenExpiry(jwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
  });

  it("says nothing rather than guessing when the token does not say", () => {
    expect(accessTokenExpiry(jwt({ sub: "x" }))).toBeUndefined();
    expect(accessTokenExpiry(jwt({ exp: "soon" }))).toBeUndefined();
  });
});

describe("checkGrantedScopes", () => {
  it("passes a token carrying what the resource needs", () => {
    const check = checkGrantedScopes(jwt({ scope: "openid profile workflows.execute" }));

    expect(check).toEqual({ ok: true, granted: ["openid", "profile", "workflows.execute"] });
  });

  it("names the dropped scope, which is the only place it is ever named", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const check = checkGrantedScopes(jwt({ scope: "openid profile" }));

    expect(check).toEqual({
      ok: false,
      granted: ["openid", "profile"],
      missing: ["workflows.execute"],
      reason: "scope",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("fails an undecodable token instead of hoping the resource accepts it", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(checkGrantedScopes("rt:this-is-a-refresh-token")).toMatchObject({
      ok: false,
      reason: "undecodable",
    });
    log.mockRestore();
  });

  it("never puts the token in the log line", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    checkGrantedScopes("not.a.token");

    expect(JSON.stringify(log.mock.calls)).not.toContain("not.a.token");
    log.mockRestore();
  });

  it("takes the required set as an argument, so a caller can check its own", () => {
    expect(checkGrantedScopes(jwt({ scope: "openid" }), ["openid"])).toMatchObject({ ok: true });
  });
});
