// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { MAX_ENTROPY_BYTES } from "@constants/index";
import { supplyRandomBytes } from "../entropy";

describe("supplyRandomBytes", () => {
    it("returns the number of bytes asked for", () => {
        const { bytes, reason } = supplyRandomBytes(32);
        expect(reason).toBeUndefined();
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect(bytes).toHaveLength(32);
    });

    it("does not return the same bytes twice", () => {
        const first = Array.from(supplyRandomBytes(32).bytes ?? []);
        const second = Array.from(supplyRandomBytes(32).bytes ?? []);
        expect(first).not.toEqual(second);
    });

    it("reports no-crypto rather than reaching for Math.random", () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.stubGlobal("crypto", undefined);
        try {
            const { bytes, reason } = supplyRandomBytes(32);
            expect(bytes).toBeNull();
            expect(reason).toBe("no-crypto");
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it("refuses a length it cannot honour, and says so differently", () => {
        for (const bad of [0, -1, Number.NaN, "32", undefined, MAX_ENTROPY_BYTES + 1]) {
            const { bytes, reason } = supplyRandomBytes(bad);
            expect(bytes).toBeNull();
            expect(reason).toBe("bad-length");
        }
    });

    it("honours the largest length it allows", () => {
        expect(supplyRandomBytes(MAX_ENTROPY_BYTES).bytes).toHaveLength(MAX_ENTROPY_BYTES);
    });
});
