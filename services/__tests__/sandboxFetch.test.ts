import { afterEach, describe, expect, it, vi } from "vitest";
import { HEADERAPI, HEADER_AUTHORIZATION, HEADER_PLUGIN_NAME_KEY } from "../../constants/index";
import { sandboxFetch, type SandboxFetchFn } from "../sandboxFetch";

const reply = (over: Partial<FetchResponse> = {}): FetchResponse =>
  ({
    ok: true,
    status: 200,
    headersObject: {},
    json: async () => ({}),
    text: async () => "",
    ...over,
  }) as FetchResponse;

const stub = (response: FetchResponse = reply()) => {
  const fn = vi.fn<SandboxFetchFn>(async () => response);
  return fn;
};

const headersOf = (fn: ReturnType<typeof stub>): Record<string, string> =>
  (fn.mock.calls.at(-1)?.[1]?.headers ?? {}) as Record<string, string>;

afterEach(() => vi.restoreAllMocks());

describe("sandboxFetch", () => {
  it("reads a header from headersObject, case-insensitively", async () => {
    const fetchFn = stub(reply({ headersObject: { "X-Picsart-Credit-Available": "42" } }));

    const result = await sandboxFetch("https://api.picsart.io/v1/balance", {}, fetchFn);

    expect(result.header("x-picsart-credit-available")).toBe("42");
    expect(result.header("X-PICSART-CREDIT-AVAILABLE")).toBe("42");
    expect(result.header("absent")).toBeUndefined();
  });

  it("puts the plugin header on every request", async () => {
    const fetchFn = stub();

    await sandboxFetch("https://api.picsart.io/v1/balance", {}, fetchFn);

    expect(headersOf(fetchFn)[HEADER_PLUGIN_NAME_KEY]).toBe("Figma");
  });

  it("sends an API key and a bearer in their own headers", async () => {
    const fetchFn = stub();

    await sandboxFetch("https://api.picsart.io/v1/balance", { credential: "k" }, fetchFn);
    expect(headersOf(fetchFn)[HEADERAPI]).toBe("k");

    await sandboxFetch(
      "https://auth.picsart.com/api/oauth2/token",
      { credential: { kind: "oauth", token: "jwt" } },
      fetchFn
    );
    expect(headersOf(fetchFn)[HEADER_AUTHORIZATION]).toBe("Bearer jwt");
  });

  it("withholds the credential from a host that may not receive one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchFn = stub();

    await sandboxFetch("https://cdn.picsart.io/result.png", { credential: "k" }, fetchFn);

    expect(headersOf(fetchFn)[HEADERAPI]).toBeUndefined();
    expect(fetchFn).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain('"k"');
  });

  it("reports a thrown request as status 0 rather than rejecting", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchFn = vi.fn<SandboxFetchFn>(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await sandboxFetch("https://auth.picsart.com/api/oauth2/token", {}, fetchFn);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(log).toHaveBeenCalled();
  });

  it("answers an empty body for a request that never happened", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchFn = vi.fn<SandboxFetchFn>(async () => {
      throw new Error("offline");
    });

    const result = await sandboxFetch("https://auth.picsart.com/api/oauth2/token", {}, fetchFn);

    await expect(result.json()).resolves.toBeNull();
    await expect(result.text()).resolves.toBe("");
    expect(result.header("anything")).toBeUndefined();
  });

  it("passes the method and body through, and nothing else", async () => {
    const fetchFn = stub();

    await sandboxFetch(
      "https://auth.picsart.com/api/oauth2/token",
      { method: "POST", body: "grant_type=refresh_token", headers: { Accept: "application/json" } },
      fetchFn
    );

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://auth.picsart.com/api/oauth2/token");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe("grant_type=refresh_token");
    expect(headersOf(fetchFn).Accept).toBe("application/json");
    expect(init).not.toHaveProperty("credential");
  });

  it("surfaces a non-2xx as ok:false with the status intact", async () => {
    const fetchFn = stub(reply({ ok: false, status: 401, json: async () => ({ error: "x" }) }));

    const result = await sandboxFetch("https://auth.picsart.com/api/oauth2/token", {}, fetchFn);

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(result.error).toBeUndefined();
    await expect(result.json()).resolves.toEqual({ error: "x" });
  });
});
