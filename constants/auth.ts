export const AUTH_ORIGIN = "https://auth.picsart.com" as const;
export const AUTH_BASE = "https://auth.picsart.com/api" as const;

export const AUTH_END_SESSION = `${AUTH_BASE}/connect/logout` as const;

export const ACCOUNTS_ORIGIN = "https://accounts.picsart.com" as const;

// RFC 8628 device authorization grant. The device endpoint refuses `openid`, so no
// id_token comes back and the signed-in name is not known.
export const OAUTH_SCOPES = ["profile", "workflows.execute"] as const;

export const REQUIRED_OAUTH_SCOPES = ["workflows.execute"] as const;

export const OAUTH_CLIENT_ID = "auth-service-PluginClient" as const;

// Neither plugin realm can reach auth.picsart.com (both send `Origin: null`, which
// it refuses), so every auth-server request goes through this page, framed hidden
// in the panel. It pins OAUTH_CLIENT_ID on its side too.
export const EXCHANGE_PAGE_URL = "https://api.picsart.io/v1/figma/auth.html" as const;

export const EXCHANGE_PAGE_READY_TIMEOUT_MS = 10000;

export const EXCHANGE_TIMEOUT_MS = 20000;

// Used when the device authorization response omits `expires_in` / `interval`.
export const DEVICE_CODE_DEFAULT_LIFETIME_S = 300;
export const DEVICE_POLL_DEFAULT_INTERVAL_S = 5;

// RFC 8628 §3.5: on `slow_down` the interval grows by five seconds, permanently.
export const DEVICE_POLL_SLOW_DOWN_MS = 5000;

// Consecutive polls that may go unanswered before the sign-in gives up.
export const DEVICE_POLL_OFFLINE_TOLERANCE = 5;

export const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

export default {
    AUTH_ORIGIN,
    AUTH_BASE,
    AUTH_END_SESSION,
    ACCOUNTS_ORIGIN,
    OAUTH_SCOPES,
    REQUIRED_OAUTH_SCOPES,
    OAUTH_CLIENT_ID,
    EXCHANGE_PAGE_URL,
    EXCHANGE_PAGE_READY_TIMEOUT_MS,
    EXCHANGE_TIMEOUT_MS,
    DEVICE_CODE_DEFAULT_LIFETIME_S,
    DEVICE_POLL_DEFAULT_INTERVAL_S,
    DEVICE_POLL_SLOW_DOWN_MS,
    DEVICE_POLL_OFFLINE_TOLERANCE,
    TOKEN_EXPIRY_SKEW_MS,
};
