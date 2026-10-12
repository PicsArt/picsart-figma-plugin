import { AUTH_END_SESSION, OAUTH_CLIENT_ID } from "@constants/index";
import { authLog } from "./authLog";
import { accessTokenExpiry, checkGrantedScopes, decodeAccessToken, grantedScopes } from "./grantedScope";
import type { OAuthRecord } from "./oauthStorage";
import { sandboxFetch, type SandboxFetchFn } from "./sandboxFetch";

const form = (fields: Record<string, string>): string =>
    Object.keys(fields)
        .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(fields[name])}`)
        .join("&");

export type TokenFailureReason =
    | "unreachable"
    | "blocked"
    | "invalid_grant"
    | "http"
    | "malformed"
    | "scope";

export type TokenResult =
    | {
          ok: true;
          record: Omit<OAuthRecord, "writtenAt">;
          name?: string;
      }
    | {
          ok: false;
          reason: TokenFailureReason;
          detail?: string;
          missing?: string[];
      };

interface TokenResponseBody {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    id_token?: unknown;
    error?: unknown;
    error_description?: unknown;
}

const asText = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;

export const tokenFromBody = (
    body: unknown,
    endpoint: string,
    clientId: string = OAUTH_CLIENT_ID
): TokenResult => {
    const parsed = (body ?? null) as TokenResponseBody | null;

    const accessToken = asText(parsed?.access_token);
    if (!accessToken) {
        authLog(`${endpoint} answered 200 with no access_token`, { body: parsed });
        return { ok: false, reason: "malformed" };
    }

    const scopeCheck = checkGrantedScopes(accessToken);
    if (!scopeCheck.ok) {
        return { ok: false, reason: "scope", missing: scopeCheck.missing };
    }

    const expiresIn =
        typeof parsed?.expires_in === "number" && isFinite(parsed.expires_in)
            ? Date.now() + parsed.expires_in * 1000
            : undefined;
    const expiresAt = accessTokenExpiry(accessToken) ?? expiresIn ?? Date.now();

    const idToken = asText(parsed?.id_token);
    const name = idToken ? asText(decodeAccessToken(idToken)?.name) : undefined;

    return {
        ok: true,
        record: {
            accessToken,
            refreshToken: asText(parsed?.refresh_token),
            expiresAt,
            scopes: grantedScopes(accessToken),
            clientId,
        },
        name,
    };
};

export const endSession = async (
    params: { idToken?: string } = {},
    fetchFn?: SandboxFetchFn
): Promise<boolean> => {
    const query = form({
        client_id: OAUTH_CLIENT_ID,
        ...(params.idToken ? { id_token_hint: params.idToken } : {}),
    });

    const response = await sandboxFetch(
        `${AUTH_END_SESSION}?${query}`,
        { method: "GET", omitAttribution: true },
        fetchFn
    );

    if (!response.ok) {
        authLog("end_session_endpoint did not acknowledge the sign-out", {
            status: response.status,
        });
    }
    return response.ok;
};

export default tokenFromBody;
