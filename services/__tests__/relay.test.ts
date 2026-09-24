import { describe, expect, it, vi } from "vitest";
import { mintHandoff, pollHandoffOnce } from "../relay";
import type { SandboxFetchFn } from "../sandboxFetch";

const KEY = "k".repeat(43);
const OTHER = "j".repeat(43);

const reply = (over: Partial<FetchResponse> = {}): FetchResponse =>
    ({
        ok: true,
        status: 200,
        headersObject: {},
        json: async () => ({}),
        text: async () => "",
        ...over,
    }) as FetchResponse;

const answering = (response: FetchResponse) => vi.fn<SandboxFetchFn>(async () => response);

describe("mintHandoff", () => {
    it("returns the pair and the relay's own expiry", async () => {
        const fetchFn = answering(
            reply({
                json: async () => ({ write_key: KEY, read_key: OTHER, expires_in: 900 }),
            })
        );

        const keys = await mintHandoff(fetchFn);

        expect(keys.writeKey).toBe(KEY);
        expect(keys.readKey).toBe(OTHER);
        expect(keys.expiresIn).toBe(900);
    });

    it("sends no request headers, because a preflight would be refused", async () => {
        const fetchFn = answering(
            reply({ json: async () => ({ write_key: KEY, read_key: OTHER }) })
        );

        await mintHandoff(fetchFn);

        expect(Object.keys(fetchFn.mock.calls[0][1]?.headers ?? {})).toEqual([]);
    });

    it("falls back to the documented window when the relay omits one", async () => {
        const fetchFn = answering(
            reply({ json: async () => ({ write_key: KEY, read_key: OTHER }) })
        );
        expect((await mintHandoff(fetchFn)).expiresIn).toBe(600);
    });

    it("refuses malformed keys rather than authorizing against one", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = answering(reply({ json: async () => ({ write_key: "short", read_key: OTHER }) }));

        await expect(mintHandoff(fetchFn)).rejects.toThrow(/malformed/);
        vi.restoreAllMocks();
    });

    it("throws on a refusal, so arming reports it instead of opening a dead browser tab", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const fetchFn = answering(reply({ ok: false, status: 503 }));

        await expect(mintHandoff(fetchFn)).rejects.toThrow(/503/);
        vi.restoreAllMocks();
    });
});

describe("pollHandoffOnce", () => {
    const poll = (response: FetchResponse) => pollHandoffOnce(KEY, answering(response));

    it("reads a delivered code, with the age the relay held it for", async () => {
        const outcome = await poll(
            reply({ json: async () => ({ status: "ready", code: "ac:xyz", age_ms: 300 }) })
        );
        expect(outcome).toEqual({ kind: "ready", code: "ac:xyz", ageMs: 300 });
    });

    it("reports pending, which is the ordinary answer and not a failure", async () => {
        expect(await poll(reply({ json: async () => ({ status: "pending" }) }))).toEqual({
            kind: "pending",
        });
    });

    it("treats 404 as permanent", async () => {
        expect(await poll(reply({ ok: false, status: 404 }))).toEqual({ kind: "gone" });
    });

    it("treats 503 as retryable, because the store being down is not the sign-in failing", async () => {
        const outcome = await poll(reply({ ok: false, status: 503 }));
        expect(outcome.kind).toBe("offline");
    });

    it("treats a status-0 answer as retryable rather than as a dead sign-in", async () => {
        const outcome = await poll(reply({ ok: false, status: 0, error: "Failed to fetch" } as Partial<FetchResponse>));
        expect(outcome.kind).toBe("offline");
    });

    it("carries the provider's refusal through instead of flattening it", async () => {
        expect(
            await poll(reply({ json: async () => ({ status: "error", error: "access_denied" }) }))
        ).toEqual({ kind: "refused", error: "access_denied" });
    });

    it("keeps polling on an unrecognised status rather than declaring failure", async () => {
        const outcome = await poll(reply({ json: async () => ({ status: "brand-new" }) }));
        expect(outcome.kind).toBe("offline");
    });

    it("does not accept a ready with no code", async () => {
        const outcome = await poll(reply({ json: async () => ({ status: "ready" }) }));
        expect(outcome.kind).toBe("offline");
    });

    it("puts the read key in the query, not in a header", async () => {
        const fetchFn = answering(reply({ json: async () => ({ status: "pending" }) }));
        await pollHandoffOnce(KEY, fetchFn);

        expect(fetchFn.mock.calls[0][0]).toContain(`read_key=${KEY}`);
        expect(Object.keys(fetchFn.mock.calls[0][1]?.headers ?? {})).toEqual([]);
    });
});
