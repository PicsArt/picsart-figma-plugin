import { afterEach, describe, expect, it, vi } from "vitest";
import { authLog, maskSecret, scrubSecrets } from "../authLog";

afterEach(() => vi.restoreAllMocks());

describe("maskSecret", () => {
  it("keeps the length and the last four characters, and nothing else", () => {
    expect(maskSecret("rt:abcdefghijklmnop")).toBe("[redacted 19 chars …mnop]");
  });

  it("does not leak a short secret through its own tail", () => {
    expect(maskSecret("abcd1234")).toBe("[redacted 8 chars]");
    expect(maskSecret("abcd1234")).not.toContain("1234");
  });

  it("says what an absent or non-string secret was", () => {
    expect(maskSecret("")).toBe("[redacted empty]");
    expect(maskSecret(undefined)).toBe("[redacted undefined]");
    expect(maskSecret(42)).toBe("[redacted number]");
  });
});

describe("scrubSecrets", () => {
  it("redacts a real token response", () => {
    const scrubbed = scrubSecrets({
      access_token: "eyJhbGciOiJSUzI1NiJ9.payload.signature-value",
      refresh_token: "rt:0123456789abcdefghij",
      id_token: "eyJhbGciOiJSUzI1NiJ9.other.sig",
      token_type: "Bearer",
      expires_in: 3599,
      scope: "openid profile workflows.execute",
    }) as Record<string, string>;

    expect(scrubbed.access_token).toMatch(/^\[redacted \d+ chars/);
    expect(scrubbed.refresh_token).toMatch(/^\[redacted \d+ chars/);
    expect(scrubbed.id_token).toMatch(/^\[redacted \d+ chars/);
    expect(scrubbed.expires_in).toBe(3599);
    expect(scrubbed.scope).toBe("openid profile workflows.execute");
    expect(JSON.stringify(scrubbed)).not.toContain("signature-value");
    expect(JSON.stringify(scrubbed)).not.toContain("0123456789");
  });

  it("catches the naming variants the same field arrives under", () => {
    const scrubbed = scrubSecrets({
      accessToken: "aaaaaaaaaaaa",
      apikey: "bbbbbbbbbbbb",
      "X-Picsart-API-Key": "cccccccccccc",
      Authorization: "Bearer dddddddddddd",
      client_secret: "eeeeeeeeeeee",
      code_verifier: "ffffffffffff",
      password: "gggggggggggg",
    });

    const printed = JSON.stringify(scrubbed);
    for (const leaked of ["aaaa", "bbbb", "cccc", "dddd", "eeee", "ffff", "gggg"]) {
      expect(printed).not.toContain(leaked.repeat(3));
    }
  });

  it("reaches into nested structures and arrays", () => {
    const scrubbed = scrubSecrets({
      request: { headers: { Authorization: "Bearer secret-value-here" } },
      attempts: [{ refresh_token: "rt:another-secret-value" }],
    });

    const printed = JSON.stringify(scrubbed);
    expect(printed).not.toContain("secret-value-here");
    expect(printed).not.toContain("another-secret-value");
  });

  it("stops at a depth limit instead of recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => JSON.stringify(scrubSecrets(cyclic))).not.toThrow();
  });

  it("leaves values that are not secrets alone", () => {
    expect(scrubSecrets({ status: 401, error: "invalid_grant", endpoint: "/oauth2/token" })).toEqual(
      { status: 401, error: "invalid_grant", endpoint: "/oauth2/token" }
    );
  });
});

describe("authLog", () => {
  it("scrubs every argument, including the ones a caller thought were safe", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    authLog("refresh failed", { error: "invalid_grant" }, { refresh_token: "rt:leak-me-please" });

    expect(JSON.stringify(error.mock.calls)).not.toContain("leak-me-please");
    expect(JSON.stringify(error.mock.calls)).toContain("invalid_grant");
    expect(error.mock.calls[0][0]).toContain("[auth] refresh failed");
  });
});
