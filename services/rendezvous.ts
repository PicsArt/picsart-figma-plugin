import { AUTH_RENDEZVOUS, type AuthRendezvousMode } from "@constants/index";

export const rendezvousMode = (): AuthRendezvousMode => AUTH_RENDEZVOUS.mode;

export const needsManualCode = (): boolean => AUTH_RENDEZVOUS.mode === "paste";

export type AuthorizationResponse =
    | { kind: "code"; code: string; state?: string }
    | { kind: "error"; error: string; description?: string }
    | { kind: "unreadable" };

const readParams = (input: string): Record<string, string> => {
    const params: Record<string, string> = {};

    const questionMark = input.indexOf("?");
    let query = questionMark === -1 ? input : input.slice(questionMark + 1);
    const hash = query.indexOf("#");
    if (hash !== -1) query = query.slice(0, hash);

    for (const pair of query.split("&")) {
        const equals = pair.indexOf("=");
        if (equals <= 0) continue;
        const name = pair.slice(0, equals).trim();
        const value = pair.slice(equals + 1);
        try {
            params[name] = decodeURIComponent(value.replace(/\+/g, " "));
        } catch {
            params[name] = value;
        }
    }

    return params;
};

const looksLikeBareCode = (input: string): boolean =>
    input.length >= 8 && !/[\s?&=/]/.test(input);

export const parseAuthorizationResponse = (raw: string): AuthorizationResponse => {
    const input = (raw ?? "").trim();
    if (!input) return { kind: "unreadable" };

    if (looksLikeBareCode(input)) return { kind: "code", code: input };

    const params = readParams(input);

    if (params.error) {
        return {
            kind: "error",
            error: params.error,
            description: params.error_description || undefined,
        };
    }

    if (params.code) {
        return { kind: "code", code: params.code, state: params.state || undefined };
    }

    return { kind: "unreadable" };
};

export default parseAuthorizationResponse;
