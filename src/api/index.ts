import { TYPE_SET_BALANCE, PICSARTURL, GENAIURL, UPSCALE, GENERATEIMAGE, EDITIMAGE, EDIT_MODE_ASYNC, REMOVEBG, REMOVEBG_SHADOW_DISABLED, REMOVEBG_SHADOW_CUSTOM, REMOVE_BG_FAILED_ERR, REMOVE_BG_REJECTED_ERR, UPSCALE_FAILED_ERR, UPSCALE_REJECTED_ERR, GENERATE_IMAGE_FAILED_ERR, GENERATE_IMAGE_REJECTED_ERR, EDIT_IMAGE_FAILED_ERR, EDIT_IMAGE_REJECTED_ERR, UNSUPPORTED_MEDIA_ERR, RESULT_DOWNLOAD_FAILED_ERR } from "@constants/index";
import getImageBinary, { imageTypeOf, type PreparedSource } from "@utils/imageBinary";
import type { CredentialInput } from "@app-types/credential";
import { asCredential, customFetch } from "./customFetch";
import { getBalance } from "./getBalance";
import { describeApiFailure, describeTransientFailure, fetchResultBytes, isAbortError, isTokenError, readApiText, readJsonBody } from "./apiError";

interface GenerateImageResponse {
    inference_id?: string;
    status: string;
    message?: string;
    detail?: string;
}

interface GenerateImageStatusResponse {
    status: string;
    data?: Array<{
        id: string;
        url: string;
        status: string;
    }>;
    message?: string;
    detail?: string;
}

interface GenerateImageOptions {
    width: number;
    height: number;
    style: string;
    negative_prompt?: string;
    count?: number;
    model?: string;
}

interface EditImageOptions {
    prompt: string;
    count: number;
    format: string;
    model?: string;
}

interface EditImageResponse {
    /** The published spec's field. */
    inference_id?: string;
    /** What the older public reference documented. Belt and braces. */
    transaction_id?: string;
    id?: string;
    status?: string;
    /** Present when the call ran synchronously: one entry per requested candidate. */
    data?: Array<{ id?: string; url?: string }>;
    message?: string;
    detail?: string;
}

// Advanced removebg parameters. Every field is optional and only sent when set,
// so a request built from the UI defaults matches the one this plugin sent
// before advanced settings existed.
interface RemoveBackgroundOptions {
    output_type?: string;
    format?: string;
    model?: string;
    bg_color?: string;
    bg_blur?: number;
    scale?: string;
    auto_center?: boolean;
    stroke_size?: number;
    stroke_color?: string;
    stroke_opacity?: number;
    shadow?: string;
    shadow_opacity?: number;
    shadow_blur?: number;
    shadow_offset_x?: number;
    shadow_offset_y?: number;
}

// The GenAI API reports lowercase statuses ("processing", "success") while an
// earlier revision of this endpoint used uppercase ones ("FINISHED", "DONE").
// Match case-insensitively against both so a vocabulary change on either side
// cannot turn a finished generation back into a timeout.
const SUCCESS_STATUSES = ["success", "finished", "done"];
const IN_FLIGHT_STATUSES = ["processing", "queued", "pending", "in_progress", "running", "accepted"];
const FAILURE_STATUSES = ["failed", "error", "cancelled", "canceled", "rejected"];

const isStatus = (status: string | undefined, expected: string[]): boolean =>
    !!status && expected.indexOf(status.toLowerCase()) !== -1;

// Defined alongside the other response-reading helpers, because readJsonBody has
// to re-throw an abort rather than treat it as an unparseable body. Re-exported
// here so callers keep importing it from @api/index.
export { isAbortError };

// Both paid image endpoints answer with a URL to fetch rather than with the
// bytes. Read through it rather than indexing `res.data.url` directly: on any
// error body there is no `data`, and the bare index threw a TypeError that
// buried the API's own explanation.
const readResultUrl = (body: unknown): string | null => {
    const url = (body as { data?: { url?: unknown } } | null)?.data?.url;
    return typeof url === "string" && url ? url : null;
};

export const extractCreditsFromResponse = (response: Response): number | null => {
    const creditsHeader = response.headers.get('x-picsart-credit-available');
    if (creditsHeader) {
        const credits = parseInt(creditsHeader, 10);
        if (!isNaN(credits)) {
            return credits;
        }
    }
    return null;
};

/**
 * Read the balance and tell the sandbox about it.
 *
 * Call this **after** a paid job has finished, not when it was accepted. `getBalance`
 * is free, so the extra round trip costs nothing and is the only way to get a number
 * that reflects the charge — see `extractCreditsFromResponse` above for the
 * measurement.
 *
 * A failed read is dropped rather than posted: the sandbox's guard would reject it
 * anyway, and posting a failure here would replace a correct cached balance with a
 * worse one.
 */
export const refreshBalance = async (key: CredentialInput): Promise<void> => {
    const balance = await getBalance(key);
    if (balance.success && typeof balance.msg === "number") {
        sendMessageToSandBox(true, String(balance.msg), TYPE_SET_BALANCE);
    }
};

export const sendMessageToSandBox = (success: boolean, msg: string | Uint8Array, type? : string, scaleFactor? : number, additionalData?: Record<string, unknown>) => {
     
    parent.postMessage({ pluginMessage: {
      success,
      msg,
      type,
      scaleFactor,
      ...additionalData
    }}, "*" );
}   

export { getBalance };

export const generateImage = async (prompt: string, key: CredentialInput, options: GenerateImageOptions) => {
    if (!prompt) {
        return { success: false, msg: "Prompt is required" };
    }

    try {
        const response = await customFetch(GENAIURL + GENERATEIMAGE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credential: key,
            body: JSON.stringify({
                prompt,
                negative_prompt: options.negative_prompt || "",
                width: options.width,
                height: options.height,
                count: options.count || 1,
                style: options.style,
                // Omitted rather than sent empty, so the API applies its own
                // default model when the user has not picked one.
                ...(options.model ? { model: options.model } : {}),
            }),
        })
        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);
        const res = (await readJsonBody(response)) as GenerateImageResponse | null;

        // An accepted job is identified by 202 plus the id we need to poll with,
        // not by the status string: the API answers "processing" here, so
        // matching on a literal would reject the request it just accepted.
        if (response.status === 202 && res?.inference_id) {
            return {
                success: true as const,
                msg: "Image generation started",
                inferenceId: res.inference_id,
                updatedCredits: updatedCredits
            };
        }

        // Same treatment as the two image endpoints, and for the same reason: a
        // rejected prompt or an out-of-range size is not retryable, and the raw
        // "token_error" used to reach the user as the notification text.
        return describeApiFailure({
            status: response.status,
            body: res,
            rejected: GENERATE_IMAGE_REJECTED_ERR,
            transient: GENERATE_IMAGE_FAILED_ERR,
            credential: asCredential(key),
        });
    } catch (error) {
        console.error("Error generating image:", error);
        return describeTransientFailure(GENERATE_IMAGE_FAILED_ERR);
    }
};

export const checkGenerateImageStatus = async (inferenceId: string, key: CredentialInput, signal?: AbortSignal) => {
    try {
        const response = await customFetch(`${GENAIURL}${GENERATEIMAGE}/inferences/${inferenceId}`, {
            method: "GET",
            credential: key,
            signal,
        });

        const res = (await readJsonBody(response)) as GenerateImageStatusResponse | null;

        if (!response.ok || isTokenError(response.status, res)) {
            const failure = describeApiFailure({
                status: response.status,
                body: res,
                rejected: GENERATE_IMAGE_REJECTED_ERR,
                transient: GENERATE_IMAGE_FAILED_ERR,
                credential: asCredential(key),
            });
            return { status: "error", msg: failure.msg };
        }

        if (isStatus(res?.status, SUCCESS_STATUSES) && res?.data) {
            // Return all completed image URLs
            const completedImages = res.data.filter(item => isStatus(item.status, SUCCESS_STATUSES));
            if (completedImages.length > 0) {
                return {
                    status: "FINISHED",
                    msg: "Images generated successfully",
                    imageUrls: completedImages.map(img => img.url)
                };
            }
        }

        if (
            !isStatus(res?.status, IN_FLIGHT_STATUSES) &&
            !isStatus(res?.status, FAILURE_STATUSES)
        ) {
            // Unknown vocabulary. The caller keeps polling, which is the right
            // behaviour — but nothing server-side records that we did not recognise
            // the word, because the poll itself succeeded.
            console.warn("Unrecognised poll status; still polling:", res?.status, res);
        }

        // Still in flight, or a terminal failure the caller reports. The API's own
        // wording wins when there is any; the bare status used to be the fallback,
        // which surfaced a one-word "failed" toast with nothing to act on.
        return {
            status: typeof res?.status === "string" ? res.status : "error",
            msg: readApiText(res) || GENERATE_IMAGE_FAILED_ERR,
        };
    } catch (error) {
        // An abort is the caller withdrawing, not a status-check failure. Let it
        // propagate so the caller can stay silent instead of reporting an error
        // for work it cancelled itself.
        if (isAbortError(error)) throw error;
        console.error("Error checking image generation status:", error);
        return { status: "error", msg: "Failed to check status" };
    }
};

const DOWNLOAD_CONCURRENCY = 3;
const DOWNLOAD_ATTEMPTS = 2;
const DOWNLOAD_RETRY_DELAY_MS = 750;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const downloadOne = async (
    url: string,
    signal?: AbortSignal
): Promise<Uint8Array | null> => {
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
        const result = await fetchResultBytes(url, signal);
        if ("ok" in result) return result.bytes;
        if (!result.retryable || attempt === DOWNLOAD_ATTEMPTS) return null;
        await delay(DOWNLOAD_RETRY_DELAY_MS * attempt);
    }
    return null;
};

export const downloadGeneratedImages = async (imageUrls: string[], signal?: AbortSignal) => {
    try {
        const images: Uint8Array[] = [];
        let failed = 0;

        for (let start = 0; start < imageUrls.length; start += DOWNLOAD_CONCURRENCY) {
            if (signal?.aborted) break;
            const batch = imageUrls.slice(start, start + DOWNLOAD_CONCURRENCY);
            const settled = await Promise.all(batch.map((url) => downloadOne(url, signal)));
            settled.forEach((bytes) => (bytes ? images.push(bytes) : failed++));
        }

        if (images.length === 0) {
            return { success: false as const, msg: RESULT_DOWNLOAD_FAILED_ERR };
        }
        return { success: true as const, images, failed };
    } catch (error) {
        if (isAbortError(error)) throw error;
        console.error("Error downloading generated images:", error);
        // The thrown text is JS internals, so it stays in the console.
        return { success: false as const, msg: RESULT_DOWNLOAD_FAILED_ERR };
    }
};

export const editImage = async (
    source: PreparedSource,
    key: CredentialInput,
    options: EditImageOptions
) => {
    if (!options.prompt.trim()) {
        return { success: false as const, msg: "An instruction is required", retryable: false };
    }

    try {
        const formData = new FormData();
        // Named with the real extension so an API that reads the filename agrees with
        // the blob's own content type instead of seeing a bare "blob". The source is
        // prepared by the caller — measured, floor-checked and downscaled to Figma's
        // 4096 ceiling — because the caller is also what discloses the downscale.
        formData.append("image", source.blob, `image.${source.extension}`);
        formData.append("prompt", options.prompt);
        formData.append("count", String(options.count));
        // Sent explicitly rather than relying on a default the two authorities
        // disagree about: the worker command declares lowercase `png`, the published
        // spec declares uppercase `JPG`.
        formData.append("format", options.format);
        // A field, not the `Prefer` header — the header is not on the gateway's CORS
        // allow-list, so an iframe cannot send it. See the note above.
        formData.append("mode", EDIT_MODE_ASYNC);
        // Omitted rather than sent empty, so the API applies its own default when the
        // user has not picked a model.
        if (options.model) formData.append("model", options.model);

        const response = await customFetch(GENAIURL + EDITIMAGE, {
            method: "POST",
            credential: key,
            body: formData,
        });

        const updatedCredits = extractCreditsFromResponse(response);
        const res = (await readJsonBody(response)) as EditImageResponse | null;

        // 202 is the accepted-and-queued path this plugin asks for.
        if (response.status === 202) {
            // inference_id per the published spec; the two fallbacks cost nothing and
            // cover the `transaction_id` the older reference documented.
            const inferenceId = res?.inference_id ?? res?.transaction_id ?? res?.id;
            if (inferenceId) {
                return {
                    success: true as const,
                    inferenceId,
                    imageUrls: undefined,
                    updatedCredits,
                };
            }
            // Accepted, charged, and no id to poll with. Nothing server-side records
            // this, because from its side the request succeeded.
            console.warn("Edit accepted (202) without an inference id:", res);
            return describeTransientFailure(EDIT_IMAGE_FAILED_ERR);
        }

        // 200 means the proxy ignored `Prefer` and ran it synchronously. The result is
        // inline, in the same array shape the poll returns.
        if (response.ok) {
            const imageUrls = (res?.data ?? [])
                .map((entry) => entry.url)
                .filter((url): url is string => typeof url === "string" && !!url);
            if (imageUrls.length > 0) {
                return {
                    success: true as const,
                    inferenceId: undefined,
                    imageUrls,
                    updatedCredits,
                };
            }
            console.warn("Edit returned 200 with no result URLs:", res);
            return describeTransientFailure(EDIT_IMAGE_FAILED_ERR);
        }

        // 415 has its own sentence: the format itself was refused, which no different
        // instruction and no retry changes.
        if (response.status === 415) {
            return { success: false as const, msg: UNSUPPORTED_MEDIA_ERR, retryable: false };
        }

        return describeApiFailure({
            status: response.status,
            body: res,
            rejected: EDIT_IMAGE_REJECTED_ERR,
            transient: EDIT_IMAGE_FAILED_ERR,
            credential: asCredential(key),
        });
    } catch (error) {
        console.error("Error editing image:", error);
        return describeTransientFailure(EDIT_IMAGE_FAILED_ERR);
    }
};

export const removeBackgroundApi = async (imageBytes: Uint8Array, key: CredentialInput, options: RemoveBackgroundOptions = {}) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        // Named with the real extension so an API that reads the filename agrees
        // with the blob's own content type instead of seeing a bare "blob".
        formData.append("image", imageBinary, `image.${imageTypeOf(imageBytes).extension}`);

        if (options.output_type) formData.append("output_type", options.output_type);
        if (options.format) formData.append("format", options.format);
        if (options.model) formData.append("model", options.model);
        if (options.scale) formData.append("scale", options.scale);
        if (options.auto_center) formData.append("auto_center", "true");
        if (options.bg_color) formData.append("bg_color", options.bg_color);
        if (options.bg_blur) formData.append("bg_blur", String(options.bg_blur));
        // The colour and opacity only mean something once a stroke has width,
        // so they ride along with stroke_size instead of being sent on their own.
        if (options.stroke_size) {
            formData.append("stroke_size", String(options.stroke_size));
            if (options.stroke_color) formData.append("stroke_color", options.stroke_color);
            if (options.stroke_opacity !== undefined) formData.append("stroke_opacity", String(options.stroke_opacity));
        }
        if (options.shadow && options.shadow !== REMOVEBG_SHADOW_DISABLED) {
            formData.append("shadow", options.shadow);
            if (options.shadow_opacity !== undefined) formData.append("shadow_opacity", String(options.shadow_opacity));
            if (options.shadow_blur !== undefined) formData.append("shadow_blur", String(options.shadow_blur));
            // Offsets are read only by the "custom" direction.
            if (options.shadow === REMOVEBG_SHADOW_CUSTOM) {
                if (options.shadow_offset_x !== undefined) formData.append("shadow_offset_x", String(options.shadow_offset_x));
                if (options.shadow_offset_y !== undefined) formData.append("shadow_offset_y", String(options.shadow_offset_y));
            }
        }

        const response = await customFetch(PICSARTURL + REMOVEBG, {
            method: "POST",
            credential: key,
            body: formData,
        });

        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);

        const res = await readJsonBody(response);

        // The status is read before the body is used for anything. A 422 carries
        // the reason the image was refused, and that reason is what the user
        // needs — not a generic "try again" for a request that cannot succeed.
        if (!response.ok || isTokenError(response.status, res)) {
            return describeApiFailure({
                status: response.status,
                body: res,
                rejected: REMOVE_BG_REJECTED_ERR,
                transient: REMOVE_BG_FAILED_ERR,
                credential: asCredential(key),
            });
        }

        const resultUrl = readResultUrl(res);
        if (!resultUrl) {
            // Warned, not errored: a 200 that carries no result URL is one of the
            // contract divergences the server cannot see, because from its side
            // this request succeeded.
            console.warn("Remove background succeeded without a result URL:", res);
            return describeTransientFailure(REMOVE_BG_FAILED_ERR);
        }

        // Status-checked and origin-asserted, unlike the bare fetch this replaces.
        const download = await fetchResultBytes(resultUrl);
        if (!("ok" in download)) return download;

        return {
            success: true as const,
            msg: download.bytes,
            updatedCredits: updatedCredits
        };

    } catch (error) {
        // A thrown fetch is offline/DNS/CORS. Its message is JS internals, so the
        // console keeps it and the user gets something they can act on.
        console.error("Error removing background:", error);
        return describeTransientFailure(REMOVE_BG_FAILED_ERR);
    }
};

export const enhanceImage = async (imageBytes: Uint8Array, key: CredentialInput, scaleFactor: number, format?: string) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        // Named with the real extension so an API that reads the filename agrees
        // with the blob's own content type instead of seeing a bare "blob".
        formData.append("image", imageBinary, `image.${imageTypeOf(imageBytes).extension}`);
        formData.append('upscale_factor', scaleFactor.toString());
        if (format) formData.append("format", format);

        const response = await customFetch(PICSARTURL + UPSCALE, {
            method: "POST",
            credential: key,
            body: formData,
        });

        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);

        const res = await readJsonBody(response);

        // Upscale is the endpoint that produced the bug this handling exists for:
        // it answers 422 when the requested factor would push the result past its
        // megapixel ceiling, and that sentence names the exact factor to avoid.
        if (!response.ok || isTokenError(response.status, res)) {
            return describeApiFailure({
                status: response.status,
                body: res,
                rejected: UPSCALE_REJECTED_ERR,
                transient: UPSCALE_FAILED_ERR,
                credential: asCredential(key),
            });
        }

        const resultUrl = readResultUrl(res);
        if (!resultUrl) {
            console.warn("Upscale succeeded without a result URL:", res);
            return describeTransientFailure(UPSCALE_FAILED_ERR);
        }

        const download = await fetchResultBytes(resultUrl);
        if (!("ok" in download)) return download;

        return {
            success: true as const,
            msg: download.bytes,
            updatedCredits: updatedCredits
        };

    } catch (error) {
        console.error("Error enhancing image:", error);
        return describeTransientFailure(UPSCALE_FAILED_ERR);
    }
};

export default {
    getBalance,
    sendMessageToSandBox,
    removeBackgroundApi,
    enhanceImage,
    generateImage,
    editImage,
    checkGenerateImageStatus,
    downloadGeneratedImages
}
