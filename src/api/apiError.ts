import {
    KEY_WRONG_ERR,
    RESULT_DOWNLOAD_FAILED_ERR,
    RESULT_HOST_BLOCKED_ERR,
    RESULT_HOST_ALLOWLIST,
    TOKEN_ERR,
} from "@constants/index";

/**
 * Turns a failed Picsart response into text a user can act on.
 *
 * Every paid endpoint in this plugin used to read `res.data.url` straight off the
 * parsed body without looking at the HTTP status. An error body has no `data`, so
 * the read threw a TypeError inside the call's own try block and the catch
 * reported "Cannot read properties of undefined (reading 'url')" — with the
 * API's actual reason already thrown away by then.
 */

// Shape of the error bodies these endpoints return: `detail` is the sentence
// worth showing, `message` is the category ("Validation Failed").
interface ApiErrorBody {
    status?: unknown;
    message?: unknown;
    detail?: unknown;
}

// A validation error names the field it rejected and echoes the value back:
//   "image_url has wrong value https://cdn.picsart.io/<id>.jpeg: <the reason>"
// Both halves of that prefix belong to us, not to the user: they picked a Figma
// layer and never saw a field name or a CDN URL, so neither means anything to
// them. Only the text after the colon is about the image they chose.
// The value is `\S*` rather than `\S+` because an empty rejected value renders
// as nothing at all: "prompt has wrong value : must not be empty".
const FIELD_PREFIX = /^\s*[a-z][a-z0-9_]* has wrong value \S*:\s*/i;

export const sanitizeApiDetail = (detail: string): string =>
    detail.replace(FIELD_PREFIX, "").trim();

/**
 * A 4xx is the API rejecting this exact request: the same bytes with the same
 * settings get the same answer, so a message ending in "please try again" sends
 * the user in a circle and costs them another call to find out. 408 and 429 are
 * the exceptions — they are about timing, not about the request.
 */
export const isRetryableStatus = (status: number): boolean =>
    status === 408 || status === 429 || status >= 500;

export interface ApiFailure {
    success: false;
    msg: string;
    // False for a 4xx. Callers use it to decide whether "try again" is honest
    // advice; nothing in this repo retries automatically.
    retryable: boolean;
}

const asNonEmptyString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value : null;

/**
 * `message` values that name a category rather than describe a problem. Each one
 * has a better replacement: "token_error" is a wrong key, and "Validation Failed"
 * on its own says less than the per-tool sentence about which settings to change.
 * A `detail` always wins over both.
 */
const CATEGORY_MESSAGES = [TOKEN_ERR, "validation failed"];

/**
 * Reads the sentence the API sent, if it sent one worth showing.
 */
export const readApiText = (body: unknown): string | null => {
    const source = body as ApiErrorBody | null;
    if (!source) return null;

    const detail = asNonEmptyString(source.detail);
    if (detail) {
        const sanitized = sanitizeApiDetail(detail);
        if (sanitized) return sanitized;
    }

    const message = asNonEmptyString(source.message);
    if (message && CATEGORY_MESSAGES.indexOf(message.trim().toLowerCase()) === -1) {
        return sanitizeApiDetail(message);
    }

    return null;
};

export const isTokenError = (status: number, body: unknown): boolean =>
    status === 401 || (!!body && (body as ApiErrorBody).message === TOKEN_ERR);

/**
 * @param rejected  fallback for a request the API refused and will refuse again
 * @param transient fallback for a failure that a later attempt could survive
 */
export const describeApiFailure = ({
    status,
    body,
    rejected,
    transient,
}: {
    status: number;
    body: unknown;
    rejected: string;
    transient: string;
}): ApiFailure => {
    if (isTokenError(status, body)) {
        // A wrong key is not "please try again" territory either, and the raw
        // "token_error" used to reach the user verbatim in the Generate tab.
        return { success: false, msg: KEY_WRONG_ERR, retryable: false };
    }

    const retryable = isRetryableStatus(status);
    const apiText = readApiText(body);

    return {
        success: false,
        msg: apiText || (retryable ? transient : rejected),
        retryable,
    };
};

/**
 * For a thrown fetch (offline, DNS, CORS) and for a success body that did not
 * carry the result URL. Both are transient from the user's side, and neither
 * has any text fit to show — a raw `error.message` is JS internals.
 */
export const describeTransientFailure = (transient: string): ApiFailure => ({
    success: false,
    msg: transient,
    retryable: true,
});

// fetch rejects with a DOMException named AbortError when its signal fires.
// Matched by name rather than instanceof, because the iframe realm this runs in
// is not guaranteed to share a DOMException constructor with the caller.
export const isAbortError = (error: unknown): boolean =>
    !!error && typeof error === "object" && (error as { name?: string }).name === "AbortError";

/**
 * Whether a result URL points at a host the plugin is allowed to fetch.
 *
 * Compared by origin prefix rather than by parsing, because `new URL()` is not
 * available in every realm this code has run in, and a prefix match on
 * `https://host` followed by `/` or end-of-string cannot be fooled by a
 * lookalike hostname the way `startsWith("https://cdn.picsart.io")` alone could
 * (`https://cdn.picsart.io.evil.test/x` fails this, and passes that).
 */
export const isAllowedResultHost = (url: string): boolean =>
    RESULT_HOST_ALLOWLIST.some(
        (host) => url === host || url.indexOf(`${host}/`) === 0
    );

/**
 * Fetch the bytes a paid endpoint pointed at.
 *
 * Two rules the direct `fetch(url).blob()` this replaces broke, on a request whose
 * result the user has already been charged for:
 *
 * - **`response.ok` first.** An expired signed CDN URL answers 403 with an XML
 *   body, and `blob()` accepts it happily — the garbage bytes then reached
 *   `figma.createImage`, which threw, and the user was told "that layer cannot hold
 *   an image". The wrong cause, for a result that exists.
 * - **The origin is asserted.** Figma's sandbox only permits the manifest's
 *   `allowedDomains`, so a result from an unlisted host fails as a generic network
 *   error naming the wrong thing. Checked here so it names the right one.
 */
export const fetchResultBytes = async (
    url: string,
    signal?: AbortSignal
): Promise<{ ok: true; bytes: Uint8Array } | ApiFailure> => {
    if (!isAllowedResultHost(url)) {
        console.error("Result URL is not on the allowed host list:", url);
        return { success: false, msg: RESULT_HOST_BLOCKED_ERR, retryable: false };
    }

    try {
        const response = await fetch(url, signal ? { signal } : undefined);
        if (!response.ok) {
            console.error(`Result download failed with HTTP ${response.status}:`, url);
            return {
                success: false,
                msg: RESULT_DOWNLOAD_FAILED_ERR,
                retryable: isRetryableStatus(response.status),
            };
        }
        const buffer = await (await response.blob()).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        if (!bytes.length) {
            console.error("Result download returned an empty body:", url);
            return describeTransientFailure(RESULT_DOWNLOAD_FAILED_ERR);
        }
        return { ok: true, bytes };
    } catch (error) {
        // An abort is the caller withdrawing; it must keep propagating as one.
        if (isAbortError(error)) throw error;
        console.error("Result download threw:", error);
        return describeTransientFailure(RESULT_DOWNLOAD_FAILED_ERR);
    }
};

/**
 * Parses a body without letting an HTML or empty error page throw. An error
 * status often comes back as a gateway's HTML, and `response.json()` throwing on
 * it used to land in the same catch block as a network failure.
 */
export const readJsonBody = async (response: Response): Promise<unknown> => {
    try {
        return await response.json();
    } catch (error) {
        // An abort part-way through the body is the caller withdrawing, not an
        // unparseable body, and it has to keep propagating as one.
        if (isAbortError(error)) throw error;
        return null;
    }
};
