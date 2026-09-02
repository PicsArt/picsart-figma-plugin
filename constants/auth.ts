export const AUTH_ORIGIN = "https://auth.picsart.com" as const;
export const AUTH_BASE = "https://auth.picsart.com/api" as const;

export const AUTH_DISCOVERY = `${AUTH_BASE}/.well-known/openid-configuration` as const;
export const AUTH_AUTHORIZE = `${AUTH_BASE}/oauth2/authorize` as const;
export const AUTH_TOKEN = `${AUTH_BASE}/oauth2/token` as const;
export const AUTH_JWKS = `${AUTH_BASE}/oauth2/jwks` as const;

export const AUTH_END_SESSION = `${AUTH_BASE}/connect/logout` as const;

export const ACCOUNTS_ORIGIN = "https://accounts.picsart.com" as const;

export const OAUTH_SCOPES = ["openid", "profile", "workflows.execute"] as const;

export const REQUIRED_OAUTH_SCOPES = ["workflows.execute"] as const;

export const RELAY_BASE = "https://api.picsart.io/v1/auth/handoff" as const;
export const RELAY_MINT = RELAY_BASE;
export const RELAY_RESULT = `${RELAY_BASE}/result` as const;

export const OAUTH_CLIENT_ID = "dcr-1e37e9dd-0f8d-4927-800b-b0eac86b62f8" as const;

export const OAUTH_REDIRECT_URI = `${RELAY_BASE}/callback` as const;

export const EXCHANGE_PAGE_URL = "https://api.picsart.io/v1/figma/auth.html" as const;

export const EXCHANGE_PAGE_READY_TIMEOUT_MS = 10000;

export const EXCHANGE_TIMEOUT_MS = 20000;

export const ASSUMED_CODE_LIFETIME_MS = 25000;

export const RELAY_POLL_TIMEOUT_MS = 30000;
export const RELAY_OFFLINE_TOLERANCE = 5;
export const RELAY_INSTANT_POLL_MS = 250;
export const RELAY_PACE_MS = 500;

export const RELAY_SPARE_MAX_AGE_MS = 240000;

export type AuthRendezvousMode = "paste" | "relay";

export const AUTH_RENDEZVOUS: {
    mode: AuthRendezvousMode;
    relayOrigin?: string;
} = {
    mode: "relay",
    relayOrigin: "https://api.picsart.io",
};

export const SIGN_IN_TIMEOUT_MS = 10 * 60 * 1000;

export const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

export const ENTROPY_TIMEOUT_MS = 5000;

export const MAX_ENTROPY_BYTES = 1024;

export default {
    AUTH_ORIGIN,
    AUTH_BASE,
    AUTH_DISCOVERY,
    AUTH_AUTHORIZE,
    AUTH_TOKEN,
    AUTH_JWKS,
    AUTH_END_SESSION,
    ACCOUNTS_ORIGIN,
    OAUTH_SCOPES,
    REQUIRED_OAUTH_SCOPES,
    OAUTH_CLIENT_ID,
    OAUTH_REDIRECT_URI,
    AUTH_RENDEZVOUS,
    RELAY_BASE,
    RELAY_MINT,
    RELAY_RESULT,
    EXCHANGE_PAGE_URL,
    EXCHANGE_PAGE_READY_TIMEOUT_MS,
    EXCHANGE_TIMEOUT_MS,
    ASSUMED_CODE_LIFETIME_MS,
    RELAY_POLL_TIMEOUT_MS,
    RELAY_OFFLINE_TOLERANCE,
    RELAY_INSTANT_POLL_MS,
    RELAY_PACE_MS,
    RELAY_SPARE_MAX_AGE_MS,
    SIGN_IN_TIMEOUT_MS,
    TOKEN_EXPIRY_SKEW_MS,
    ENTROPY_TIMEOUT_MS,
    MAX_ENTROPY_BYTES,
};
