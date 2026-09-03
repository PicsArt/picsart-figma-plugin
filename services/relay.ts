import {
    RELAY_MINT,
    RELAY_RESULT,
} from "@constants/index";
import { authLog } from "./authLog";
import { sandboxFetch, type SandboxFetchFn } from "./sandboxFetch";

const isKey = (value: unknown): value is string =>
    typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export interface HandoffKeys {
    writeKey: string;
    readKey: string;
    expiresIn: number;
    mintedAt: number;
}

interface MintBody {
    write_key?: unknown;
    read_key?: unknown;
    expires_in?: unknown;
}

export const mintHandoff = async (fetchFn?: SandboxFetchFn): Promise<HandoffKeys> => {
    const response = await sandboxFetch(
        RELAY_MINT,
        { method: "POST", omitAttribution: true },
        fetchFn
    );

    if (!response.ok) {
        authLog("the relay refused to mint a key pair", { status: response.status });
        throw new Error(`relay mint HTTP ${response.status}`);
    }

    const body = (await response.json()) as MintBody | null;
    if (!isKey(body?.write_key) || !isKey(body?.read_key)) {
        authLog("the relay minted malformed keys");
        throw new Error("relay mint returned malformed keys");
    }

    return {
        writeKey: body.write_key,
        readKey: body.read_key,
        expiresIn: typeof body.expires_in === "number" && body.expires_in > 0
            ? body.expires_in
            : 600,
        mintedAt: Date.now(),
    };
};

export type PollOutcome =
    | { kind: "pending" }
    | { kind: "ready"; code: string; ageMs?: number }
    | { kind: "refused"; error: string }
    | { kind: "gone" }
    | { kind: "offline"; reason: string };

interface ResultBody {
    status?: unknown;
    code?: unknown;
    error?: unknown;
    age_ms?: unknown;
}

export const pollHandoffOnce = async (
    readKey: string,
    fetchFn?: SandboxFetchFn
): Promise<PollOutcome> => {
    const response = await sandboxFetch(
        `${RELAY_RESULT}?read_key=${encodeURIComponent(readKey)}`,
        { method: "GET", omitAttribution: true },
        fetchFn
    );

    if (response.status === 0) {
        return { kind: "offline", reason: String(response.error ?? "no answer") };
    }
    if (response.status === 404) return { kind: "gone" };
    if (response.status === 503) return { kind: "offline", reason: "relay store unavailable" };
    if (!response.ok) return { kind: "offline", reason: `relay poll HTTP ${response.status}` };

    const body = (await response.json()) as ResultBody | null;
    if (!body) return { kind: "offline", reason: "unreadable relay reply" };

    if (body.status === "pending") return { kind: "pending" };
    if (body.status === "ready") {
        if (typeof body.code !== "string" || !body.code) {
            return { kind: "offline", reason: "relay reported ready with no code" };
        }
        return {
            kind: "ready",
            code: body.code,
            ageMs: typeof body.age_ms === "number" ? body.age_ms : undefined,
        };
    }
    if (body.status === "error") {
        return { kind: "refused", error: String(body.error ?? "unknown") };
    }

    return { kind: "offline", reason: `unrecognised relay status: ${String(body.status)}` };
};
