import {
    ACCOUNTS_ORIGIN,
    DEVICE_CODE_DEFAULT_LIFETIME_S,
    DEVICE_POLL_DEFAULT_INTERVAL_S,
    DEVICE_POLL_OFFLINE_TOLERANCE,
    DEVICE_POLL_SLOW_DOWN_MS,
    OAUTH_CLIENT_ID,
    OAUTH_SCOPES,
    SESSION_ENDED_ERR,
    SESSION_SCOPE_ERR,
    SIGNED_OUT_MSG,
    SIGNED_OUT_USING_KEY_MSG,
    SIGN_IN_CANCELLED_MSG,
    SIGN_IN_BLOCKED_ERR,
    SIGN_IN_FAILED_ERR,
    SIGN_IN_NOT_REMEMBERED_ERR,
    SIGN_IN_TIMED_OUT_ERR,
    SIGN_IN_UNREACHABLE_ERR,
    TOKEN_EXPIRY_SKEW_MS,
    TYPE_AUTH_STATE,
    TYPE_CREDENTIAL,
} from "@constants/index";
import type { AuthState } from "@app-types/auth";
import type { CredentialDescriptor } from "@app-types/credential";
import { readApiKey } from "./apiKeyStorage";
import { authLog } from "./authLog";
import { endSession, tokenFromBody, type TokenResult } from "./oauthClient";
import {
    pollDeviceViaPage,
    refreshViaPage,
    startDeviceViaPage,
    type ExchangeReply,
} from "./exchangePage";
import {
    classifyInvalidGrant,
    clearOAuthRecord,
    credentialFromRecord,
    isAccessTokenExpired,
    readOAuthRecord,
    writeOAuthRecord,
    type OAuthRecord,
} from "./oauthStorage";
import type { SandboxFetchFn } from "./sandboxFetch";
import { postToUi } from "./UiBridge";

interface PendingSignIn {
    deviceCode: string;
    userCode: string;
    verificationUri: string;
    verificationUriComplete?: string;
    expiresAt: number;
    intervalMs: number;
}

let pending: PendingSignIn | undefined;
let pollGeneration = 0;
let state: AuthState = { status: "idle" };
let displayName: string | undefined;

let refreshInFlight: Promise<CredentialDescriptor | undefined> | undefined;

export const authState = (): AuthState => state;

const setState = (pluginApi: PluginAPI, next: AuthState) => {
    state = next;
    postToUi(pluginApi, { type: TYPE_AUTH_STATE, payload: next });
};

const setStateQuietly = (next: AuthState) => {
    state = next;
};

const isLiveFlow = (): boolean =>
    state.status === "starting" || state.status === "awaiting" || state.status === "working";

export const postAuthState = (pluginApi: PluginAPI) => {
    postToUi(pluginApi, { type: TYPE_AUTH_STATE, payload: state });
};

export const acknowledgeTerminalAuthState = () => {
    if (state.status === "denied" || state.status === "failed") state = { status: "idle" };
};

const signedInState = (record: OAuthRecord): AuthState => ({
    status: "signedIn",
    name: displayName,
    scopes: record.scopes ?? [],
    expiresAt: record.expiresAt,
});

export interface ActiveCredential {
    credential: CredentialDescriptor | null;
    apiKey: string;
}

export const postCredential = (
    pluginApi: PluginAPI,
    active: ActiveCredential,
    requestId?: string
) => {
    postToUi(pluginApi, {
        type: TYPE_CREDENTIAL,
        payload: { credential: active.credential, apiKey: active.apiKey },
        ...(requestId ? { requestId } : {}),
    });
};

const endOAuthSession = async (pluginApi: PluginAPI, reason: string) => {
    await clearOAuthRecord(pluginApi);
    displayName = undefined;
    setState(pluginApi, { status: "failed", reason });
};

const refreshThroughPage = async (
    pluginApi: PluginAPI,
    refreshToken: string,
    clientId: string
): Promise<TokenResult> => {
    const reply = await refreshViaPage(pluginApi, refreshToken, clientId);

    if (!reply.ok) {
        authLog("the exchange page could not spend the refresh token", {
            error: reply.error,
            status: reply.status,
            throttled: reply.throttled,
        });
        return { ok: false, reason: reply.reason, detail: reply.error };
    }

    return tokenFromBody(reply, "figma/auth.html (refresh_token)", clientId);
};

const refreshRecord = async (
    pluginApi: PluginAPI,
    record: OAuthRecord
): Promise<CredentialDescriptor | undefined> => {
    if (!record.refreshToken) {
        authLog("the stored session has no refresh token, so it ends at expiry");
        await endOAuthSession(pluginApi, SESSION_ENDED_ERR);
        return undefined;
    }

    setStateQuietly({ status: "working" });
    const result = await refreshThroughPage(
        pluginApi,
        record.refreshToken,
        record.clientId ?? OAUTH_CLIENT_ID
    );

    if (result.ok) {
        const refreshed = {
            ...result.record,
            refreshToken: result.record.refreshToken ?? record.refreshToken,
        };
        const stored = await writeOAuthRecord(pluginApi, refreshed);
        if (result.name) displayName = result.name;
        const effective = stored ?? { ...refreshed, writtenAt: record.writtenAt };
        setStateQuietly(signedInState(effective));
        return credentialFromRecord(effective);
    }

    if (result.reason === "unreachable" || result.reason === "blocked") {
        setState(pluginApi, {
            status: "failed",
            reason:
                result.reason === "blocked" ? SIGN_IN_BLOCKED_ERR : SIGN_IN_UNREACHABLE_ERR,
        });
        return undefined;
    }

    if (result.reason === "scope") {
        authLog("the refreshed token was missing a required scope", {
            missing: result.missing,
        });
        await endOAuthSession(pluginApi, SESSION_SCOPE_ERR);
        return undefined;
    }

    if (result.reason === "invalid_grant") {
        const verdict = await classifyInvalidGrant(pluginApi, record);

        if (verdict.outcome === "rotated") {
            authLog("another document rotated the session; adopting the stored record");
            setStateQuietly(signedInState(verdict.record));
            return isAccessTokenExpired(verdict.record, TOKEN_EXPIRY_SKEW_MS)
                ? undefined
                : credentialFromRecord(verdict.record);
        }

        if (verdict.outcome === "gone") {
            displayName = undefined;
            setState(pluginApi, { status: "idle" });
            return undefined;
        }

        await endOAuthSession(pluginApi, SESSION_ENDED_ERR);
        return undefined;
    }

    await endOAuthSession(pluginApi, result.detail ? SESSION_ENDED_ERR : SIGN_IN_FAILED_ERR);
    return undefined;
};

export const activeCredential = async (
    pluginApi: PluginAPI
): Promise<ActiveCredential> => {
    const apiKey = (await readApiKey(pluginApi)) ?? "";
    const record = await readOAuthRecord(pluginApi);

    if (!record) {
        if (state.status === "signedIn") {
            displayName = undefined;
            setStateQuietly({ status: "idle" });
        }
        return {
            credential: apiKey ? { kind: "apikey", token: apiKey } : null,
            apiKey,
        };
    }

    if (!isAccessTokenExpired(record, TOKEN_EXPIRY_SKEW_MS)) {
        if (!isLiveFlow()) setStateQuietly(signedInState(record));
        return { credential: credentialFromRecord(record), apiKey };
    }

    if (!refreshInFlight) {
        refreshInFlight = refreshRecord(pluginApi, record).then((credential) => {
            refreshInFlight = undefined;
            return credential;
        });
    }
    const refreshed = await refreshInFlight;

    return {
        credential: refreshed ?? (apiKey ? { kind: "apikey", token: apiKey } : null),
        apiKey,
    };
};

const asText = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;

const asPositive = (value: unknown, fallback: number): number =>
    typeof value === "number" && isFinite(value) && value > 0 ? value : fallback;

// The plugin opens this address in the user's browser, so it must be the accounts
// front end and nothing a tampered reply could substitute.
const isVerificationUri = (value: string | undefined): value is string =>
    !!value && value.indexOf(`${ACCOUNTS_ORIGIN}/`) === 0;

const failureReason = (reason: string): string =>
    reason === "blocked"
        ? SIGN_IN_BLOCKED_ERR
        : reason === "unreachable"
          ? SIGN_IN_UNREACHABLE_ERR
          : reason === "scope"
            ? SESSION_SCOPE_ERR
            : SIGN_IN_FAILED_ERR;

const awaitingState = (flow: PendingSignIn): AuthState => ({
    status: "awaiting",
    userCode: flow.userCode,
    verificationUri: flow.verificationUri,
    verificationUriComplete: flow.verificationUriComplete,
    expiresAt: flow.expiresAt,
});

const pendingFromReply = (reply: ExchangeReply): PendingSignIn | undefined => {
    if (!reply.ok) return undefined;

    const deviceCode = asText(reply.device_code);
    const userCode = asText(reply.user_code);
    const verificationUri = asText(reply.verification_uri);
    const complete = asText(reply.verification_uri_complete);

    if (!deviceCode || !userCode || !isVerificationUri(verificationUri)) {
        authLog("the device authorization reply was unusable", {
            hasDeviceCode: !!deviceCode,
            userCode,
            verificationUri,
        });
        return undefined;
    }

    return {
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete: isVerificationUri(complete) ? complete : undefined,
        expiresAt:
            Date.now() + asPositive(reply.expires_in, DEVICE_CODE_DEFAULT_LIFETIME_S) * 1000,
        intervalMs: asPositive(reply.interval, DEVICE_POLL_DEFAULT_INTERVAL_S) * 1000,
    };
};

export const startSignIn = async (pluginApi: PluginAPI): Promise<void> => {
    if (pending && Date.now() < pending.expiresAt) {
        setState(pluginApi, awaitingState(pending));
        return;
    }

    pending = undefined;
    const generation = ++pollGeneration;
    setState(pluginApi, { status: "starting" });

    const reply = await startDeviceViaPage(pluginApi, OAUTH_SCOPES.join(" "));
    if (generation !== pollGeneration) return;

    if (!reply.ok) {
        authLog("could not start the device sign-in", {
            error: reply.error,
            oauthError: reply.oauthError,
            status: reply.status,
            throttled: reply.throttled,
        });
        setState(pluginApi, { status: "failed", reason: failureReason(reply.reason) });
        return;
    }

    const flow = pendingFromReply(reply);
    if (!flow) {
        setState(pluginApi, { status: "failed", reason: SIGN_IN_FAILED_ERR });
        return;
    }

    pending = flow;
    setState(pluginApi, awaitingState(flow));

    try {
        pluginApi.openExternal(flow.verificationUriComplete ?? flow.verificationUri);
    } catch (error) {
        // The panel still shows the code and a button that opens the page.
        authLog("could not open the browser", { error: String(error) });
    }

    void runDevicePoll(pluginApi, flow, generation);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runDevicePoll = async (
    pluginApi: PluginAPI,
    flow: PendingSignIn,
    generation: number
): Promise<void> => {
    let intervalMs = flow.intervalMs;
    let offlineStreak = 0;

    const end = (next: AuthState) => {
        pending = undefined;
        setState(pluginApi, next);
    };

    while (generation === pollGeneration) {
        await wait(intervalMs);
        if (generation !== pollGeneration) return;

        if (Date.now() >= flow.expiresAt) {
            end({ status: "failed", reason: SIGN_IN_TIMED_OUT_ERR });
            return;
        }

        const reply = await pollDeviceViaPage(pluginApi, flow.deviceCode);
        if (generation !== pollGeneration) return;

        if (reply.ok) {
            pending = undefined;
            await completeSignIn(pluginApi, reply);
            return;
        }

        switch (reply.oauthError) {
            case "authorization_pending":
                offlineStreak = 0;
                continue;
            case "slow_down":
                offlineStreak = 0;
                intervalMs += DEVICE_POLL_SLOW_DOWN_MS;
                continue;
            case "access_denied":
                end({ status: "denied" });
                return;
            case "expired_token":
                end({ status: "failed", reason: SIGN_IN_TIMED_OUT_ERR });
                return;
        }

        // A readable 429 arrives with a status, so it classifies as "http", not "blocked".
        if (reply.reason === "unreachable" || reply.reason === "blocked" || reply.throttled) {
            // A throttled poll is answered by waiting longer, never by polling sooner.
            if (reply.throttled) intervalMs += DEVICE_POLL_SLOW_DOWN_MS;
            if (++offlineStreak < DEVICE_POLL_OFFLINE_TOLERANCE) continue;
        }

        authLog("the device sign-in poll was refused", {
            error: reply.error,
            oauthError: reply.oauthError,
            status: reply.status,
        });
        end({ status: "failed", reason: failureReason(reply.reason) });
        return;
    }
};

const completeSignIn = async (pluginApi: PluginAPI, reply: ExchangeReply): Promise<void> => {
    setState(pluginApi, { status: "working" });

    const result = tokenFromBody(reply, "figma/auth.html (device_code)");
    if (!result.ok) {
        setState(pluginApi, { status: "failed", reason: failureReason(result.reason) });
        return;
    }

    displayName = result.name;
    const stored = await writeOAuthRecord(pluginApi, result.record);

    if (!stored) {
        const effective = { ...result.record, writtenAt: 0 };
        setState(pluginApi, signedInState(effective));
        pluginApi.notify(SIGN_IN_NOT_REMEMBERED_ERR, { error: true });
        postCredential(pluginApi, {
            credential: credentialFromRecord(effective),
            apiKey: (await readApiKey(pluginApi)) ?? "",
        });
        return;
    }

    setState(pluginApi, signedInState(stored));
    postCredential(pluginApi, await activeCredential(pluginApi));
};

export const cancelSignIn = async (pluginApi: PluginAPI): Promise<void> => {
    const wasPending = hasPendingSignIn();
    pending = undefined;
    pollGeneration += 1;
    setState(pluginApi, { status: "idle" });
    if (wasPending) pluginApi.notify(SIGN_IN_CANCELLED_MSG);
};

export const signOut = async (
    pluginApi: PluginAPI,
    fetchFn?: SandboxFetchFn
): Promise<ActiveCredential> => {
    pending = undefined;
    pollGeneration += 1;
    displayName = undefined;

    await clearOAuthRecord(pluginApi);
    const active = await activeCredential(pluginApi);
    setState(pluginApi, { status: "idle" });

    pluginApi.notify(active.apiKey ? SIGNED_OUT_USING_KEY_MSG : SIGNED_OUT_MSG);

    void endSession({}, fetchFn);

    return active;
};

export const refreshCredentialNow = async (
    pluginApi: PluginAPI
): Promise<ActiveCredential> => {
    const record = await readOAuthRecord(pluginApi);
    const apiKey = (await readApiKey(pluginApi)) ?? "";

    if (!record) {
        return { credential: apiKey ? { kind: "apikey", token: apiKey } : null, apiKey };
    }

    if (!refreshInFlight) {
        refreshInFlight = refreshRecord(pluginApi, record).then((credential) => {
            refreshInFlight = undefined;
            return credential;
        });
    }
    const refreshed = await refreshInFlight;

    return {
        credential: refreshed ?? (apiKey ? { kind: "apikey", token: apiKey } : null),
        apiKey,
    };
};

export const resetAuthSession = () => {
    pending = undefined;
    state = { status: "idle" };
    displayName = undefined;
    refreshInFlight = undefined;
    pollGeneration += 1;
};

export const hasPendingSignIn = (): boolean => !!pending && Date.now() < pending.expiresAt;
