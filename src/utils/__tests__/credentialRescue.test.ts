import { describe, expect, it, vi } from "vitest";
import { withCredentialRescue } from "../credentialRescue";
import { KEY_WRONG_ERR, SESSION_EXPIRED_ERR, BEARER_REJECTED_ERR } from "@constants/index";
import type { CredentialDescriptor, CredentialInput } from "@app-types/credential";

const LIVE: CredentialDescriptor = { kind: "oauth", token: "fresh", scopes: ["workflows.execute"] };
const DEAD: CredentialDescriptor = { kind: "oauth", token: "dead", scopes: ["workflows.execute"] };

const expired = {
    success: false as const,
    msg: SESSION_EXPIRED_ERR,
    retryable: true,
    tokenFailure: "session-expired" as const,
};

describe("withCredentialRescue", () => {
    it("refreshes once and retries with the token the refresh produced", async () => {
        let current: CredentialInput = DEAD;
        const seen: CredentialInput[] = [];
        const call = vi.fn(async (credential: CredentialInput) => {
            seen.push(credential);
            return credential === LIVE ? { success: true as const, msg: "ok" } : expired;
        });

        const result = await withCredentialRescue(call, {
            credential: () => current,
            refresh: async () => {
                current = LIVE;
                return true;
            },
            fallback: DEAD,
        });

        expect(result).toEqual({ success: true, msg: "ok" });
        expect(seen).toEqual([DEAD, LIVE]);
    });

    it("does not call twice when the first attempt succeeds", async () => {
        const call = vi.fn(async () => ({ success: true as const, msg: "ok" }));
        const refresh = vi.fn(async () => true);

        await withCredentialRescue(call, {
            credential: () => LIVE,
            refresh,
            fallback: LIVE,
        });

        expect(call).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
    });

    it("retries at most once, so a second identical 401 is not paid for a third time", async () => {
        const call = vi.fn(async () => expired);

        const result = await withCredentialRescue(call, {
            credential: () => DEAD,
            refresh: async () => true,
            fallback: DEAD,
        });

        expect(call).toHaveBeenCalledTimes(2);
        expect(result).toBe(expired);
    });

    it("returns the first failure when the session is really over", async () => {
        const call = vi.fn(async () => expired);
        const result = await withCredentialRescue(call, {
            credential: () => DEAD,
            refresh: async () => false,
            fallback: DEAD,
        });

        expect(call).toHaveBeenCalledTimes(1);
        expect(result).toBe(expired);
    });

    it("does not refresh a wrong API key", async () => {
        const refusal = {
            success: false as const,
            msg: KEY_WRONG_ERR,
            retryable: false,
            tokenFailure: "wrong-key" as const,
        };
        const call = vi.fn(async () => refusal);
        const refresh = vi.fn(async () => true);

        await withCredentialRescue(call, {
            credential: () => "a-key",
            refresh,
            fallback: "a-key",
        });

        expect(call).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
    });

    it("does not refresh a route that refuses bearers", async () => {
        const refusal = {
            success: false as const,
            msg: BEARER_REJECTED_ERR,
            retryable: false,
            tokenFailure: "bearer-rejected" as const,
        };
        const refresh = vi.fn(async () => true);

        await withCredentialRescue(async () => refusal, {
            credential: () => LIVE,
            refresh,
            fallback: LIVE,
        });

        expect(refresh).not.toHaveBeenCalled();
    });

    it("leaves a non-401 failure alone", async () => {
        const rejected = { success: false as const, msg: "prompt is too long", retryable: false };
        const refresh = vi.fn(async () => true);

        const result = await withCredentialRescue(async () => rejected, {
            credential: () => LIVE,
            refresh,
            fallback: LIVE,
        });

        expect(result).toBe(rejected);
        expect(refresh).not.toHaveBeenCalled();
    });

    it("falls back to the prop when no provider is mounted", async () => {
        const seen: CredentialInput[] = [];
        await withCredentialRescue(
            async (credential) => {
                seen.push(credential);
                return { success: true as const, msg: "ok" };
            },
            { credential: () => undefined, refresh: async () => false, fallback: "a-key" }
        );

        expect(seen).toEqual(["a-key"]);
    });
});
