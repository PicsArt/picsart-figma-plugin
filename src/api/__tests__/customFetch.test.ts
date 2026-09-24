import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORS_SAFE_REQUEST_HEADERS,
  HEADERAPI,
  HEADER_AUTHORIZATION,
  HEADER_PLUGIN_NAME_KEY,
  HEADER_PLUGIN_NAME_VALUE,
} from "@constants/index";
import { asCredential, customFetch } from "../customFetch";

const fetchMock = vi.fn();
const lastInit = () => fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
const lastHeaders = () => (lastInit().headers ?? {}) as Record<string, string>;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe("customFetch", () => {
  it("adds the plugin header to a request that sets none", async () => {
    await customFetch("https://api.picsart.io/tools/v1/balance");

    expect(lastHeaders()[HEADER_PLUGIN_NAME_KEY]).toBe(HEADER_PLUGIN_NAME_VALUE);
  });

  it("keeps the caller's headers alongside it", async () => {
    await customFetch("https://api.picsart.io/tools/v1/balance", {
      headers: { [HEADERAPI]: "test-api-key", "Content-Type": "application/json" },
    });

    expect(lastHeaders()).toEqual({
      [HEADERAPI]: "test-api-key",
      "Content-Type": "application/json",
      [HEADER_PLUGIN_NAME_KEY]: HEADER_PLUGIN_NAME_VALUE,
    });
  });

  it("does not let a caller replace the plugin header", async () => {
    await customFetch("https://api.picsart.io/tools/v1/balance", {
      headers: { [HEADER_PLUGIN_NAME_KEY]: "not-figma" },
    });

    expect(lastHeaders()[HEADER_PLUGIN_NAME_KEY]).toBe(HEADER_PLUGIN_NAME_VALUE);
  });

  it("passes the rest of the request through untouched", async () => {
    const signal = new AbortController().signal;
    await customFetch("https://api.picsart.io/tools/v1/balance", {
      method: "POST",
      signal,
    });

    expect(lastInit().method).toBe("POST");
    expect(lastInit().signal).toBe(signal);
  });

  it("sends nothing the gateway's CORS preflight would block", async () => {
    await customFetch("https://api.picsart.io/tools/v1/balance", {
      headers: { [HEADERAPI]: "test-api-key" },
    });

    const blocked = Object.keys(lastHeaders()).filter(
      (h) => CORS_SAFE_REQUEST_HEADERS.indexOf(h.toLowerCase() as never) === -1
    );
    expect(blocked).toEqual([]);
  });
});

describe("the credential", () => {
  it("normalizes a bare string to an API key, which is what every caller passes", () => {
    expect(asCredential("k")).toEqual({ kind: "apikey", token: "k" });
  });

  it("sends an API key in the API-key header", async () => {
    await customFetch("https://api.picsart.io/v1/balance", { credential: "test-api-key" });

    expect(lastHeaders()[HEADERAPI]).toBe("test-api-key");
    expect(lastHeaders()[HEADER_AUTHORIZATION]).toBeUndefined();
  });

  it("sends an access token as a bearer, in the other header", async () => {
    await customFetch("https://api.picsart.io/v1/balance", {
      credential: { kind: "oauth", token: "jwt-value" },
    });

    expect(lastHeaders()[HEADER_AUTHORIZATION]).toBe("Bearer jwt-value");
    expect(lastHeaders()[HEADERAPI]).toBeUndefined();
  });

  it("withholds it from a result CDN, which is the host it must never reach", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await customFetch("https://cdn.picsart.io/result.png", { credential: "test-api-key" });

    expect(lastHeaders()[HEADERAPI]).toBeUndefined();
    expect(fetchMock).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("test-api-key");
    warn.mockRestore();
  });

  it("strips a credential a caller set through `headers` as well", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await customFetch("https://aicdn.picsart.com/result.png", {
      headers: { [HEADERAPI]: "test-api-key", [HEADER_AUTHORIZATION]: "Bearer x" },
    });

    expect(lastHeaders()[HEADERAPI]).toBeUndefined();
    expect(lastHeaders()[HEADER_AUTHORIZATION]).toBeUndefined();
    warn.mockRestore();
  });

  it("says nothing when there was no credential to withhold", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await customFetch("https://cdn.picsart.io/result.png");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("keeps the bearer inside the CORS allow-list", async () => {
    await customFetch("https://api.picsart.io/v1/balance", {
      credential: { kind: "oauth", token: "jwt-value" },
    });

    const blocked = Object.keys(lastHeaders()).filter(
      (h) => CORS_SAFE_REQUEST_HEADERS.indexOf(h.toLowerCase() as never) === -1
    );
    expect(blocked).toEqual([]);
  });
});
