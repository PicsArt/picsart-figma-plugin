import { MAX_ENTROPY_BYTES } from "@constants/index";

export type EntropyFailure = "no-crypto" | "bad-length";

export interface EntropyReply {
    bytes: Uint8Array | null;
    reason?: EntropyFailure;
}

export const supplyRandomBytes = (length: unknown): EntropyReply => {
    const asked = typeof length === "number" && Number.isFinite(length) ? Math.floor(length) : 0;
    if (asked <= 0 || asked > MAX_ENTROPY_BYTES) {
        return { bytes: null, reason: "bad-length" };
    }

    if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
        console.error(
            "crypto.getRandomValues is unavailable in the plugin panel; sign-in cannot generate a safe verifier"
        );
        return { bytes: null, reason: "no-crypto" };
    }

    const bytes = new Uint8Array(asked);
    crypto.getRandomValues(bytes);
    return { bytes };
};
