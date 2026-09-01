import { GENAIURL, HEADERAPI, HEADER_PLUGIN_NAME_KEY, HEADER_PLUGIN_NAME_VALUE } from "@constants/index";
import { customFetch } from "./customFetch";
import { describeApiFailure, isAbortError, isTokenError, readApiText, readJsonBody } from "./apiError";

/**
 * The one polling loop, shared by text-to-image and image-to-image.
 *
 * It used to live inline in `GenerateImage.tsx` as a `setTimeout` chain guarded by a
 * closure boolean, and adding a second async endpoint would have produced a second
 * copy of it. Extracting it is half of what the chosen approach was justified by.
 *
 * Three things the inline version got wrong and this does not:
 *
 * - **Cancellation cancels the fetch**, through an `AbortSignal`, rather than setting
 *   a flag that ignores the answer. The old loop's closure outlived unmount, so the
 *   network calls carried on and `setLoading` fired on a component that was gone.
 * - **The window backs off** instead of being a flat 30 × 2000ms. A hard 60-second
 *   ceiling on a job that is billed at acceptance means a slow job is paid for and
 *   then abandoned.
 * - **An unrecognised status keeps polling.** A vocabulary change on the server side
 *   must not turn a finished generation into a failure.
 *
 * What it deliberately does NOT do is persist the inference id. `clientStorage` is
 * sandbox-only and keyed per user and plugin rather than per file, so a persisted id
 * from another document would be polled on reopen and its result placed in the wrong
 * file. Scoping that correctly needs a file key and a TTL; it is recorded in
 * `TODOS.md` rather than half-built here.
 */

// Lowercase, and matched case-insensitively: this endpoint family answers
// "processing"/"success" today and answered "FINISHED"/"DONE" in an earlier revision.
const SUCCESS_STATUSES = ["success", "finished", "done"];
const FAILURE_STATUSES = ["failed", "error", "cancelled", "canceled", "rejected"];
const IN_FLIGHT_STATUSES = [
  "processing",
  "queued",
  "pending",
  "in_progress",
  "running",
  "accepted",
];

const isStatus = (status: unknown, expected: string[]): boolean =>
  typeof status === "string" && expected.indexOf(status.toLowerCase()) !== -1;

/**
 * Backoff schedule, in milliseconds. Roughly 3 minutes of total window against the
 * inline loop's 60 seconds, without hammering the endpoint for the whole of it.
 */
const POLL_DELAYS_MS = [
  1000, 1500, 2000, 2000, 3000, 3000, 3000, 4000, 4000, 5000,
  5000, 5000, 6000, 6000, 8000, 8000, 10000, 10000, 12000, 15000,
  15000, 15000, 15000, 15000,
];

const delay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Without this an abort still waits out the current sleep before noticing.
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });

interface InferenceBody {
  status?: unknown;
  /**
   * An array, one entry per requested `count` — not the single `{url}` object the
   * two image endpoints return. Both `/text2image` and `/painting/edit` answer this
   * shape.
   */
  data?: Array<{ id?: string; url?: string; status?: string }>;
  message?: unknown;
  detail?: unknown;
}

export type PollOutcome =
  | { status: "finished"; imageUrls: string[] }
  | { status: "failed"; msg: string }
  | { status: "timed-out"; msg: string };

const collectUrls = (body: InferenceBody | null): string[] => {
  if (!body?.data || !Array.isArray(body.data)) return [];
  return body.data
    // A per-entry status is optional. When it is absent the entry's presence in a
    // finished body is the signal, so a missing field must not filter it out.
    .filter((entry) => !entry.status || isStatus(entry.status, SUCCESS_STATUSES))
    .map((entry) => entry.url)
    .filter((url): url is string => typeof url === "string" && !!url);
};

export interface PollOptions {
  /** Candidate poll paths, tried in order until one does not 404. */
  paths: readonly string[];
  inferenceId: string;
  key: string;
  transient: string;
  rejected: string;
  signal?: AbortSignal;
}

/**
 * Which candidate path answered, remembered for the rest of the session.
 *
 * The published spec documents `GET /v1/painting/{id}` with no `figma/` prefix, while
 * every POST this plugin makes goes through the proxy — so the proxied form is tried
 * first and the published one is the fallback. Caching the answer means the fallback
 * costs one extra GET once, not one per poll tick.
 */
const resolvedPaths = new Map<string, string>();

const pollOnce = async (
  options: PollOptions
): Promise<{ ok: true; body: InferenceBody | null } | { ok: false; msg: string; retryPath?: true }> => {
  const { paths, inferenceId, key, transient, rejected, signal } = options;
  const cacheKey = paths.join("|");
  const candidates = resolvedPaths.has(cacheKey)
    ? [resolvedPaths.get(cacheKey) as string]
    : paths;

  let lastFailure = { ok: false as const, msg: transient };

  for (const path of candidates) {
    const response = await customFetch(`${GENAIURL}${path}${inferenceId}`, {
      method: "GET",
      headers: {
        [HEADERAPI]: key,
        [HEADER_PLUGIN_NAME_KEY]: HEADER_PLUGIN_NAME_VALUE,
      },
      signal,
    });

    const body = (await readJsonBody(response)) as InferenceBody | null;

    if (response.status === 404 && candidates.length > 1) {
      // Could be a wrong path or an unknown job; either way the next candidate is
      // worth one GET, and a poll is not a billed call.
      console.warn(`Poll path ${path} answered 404; trying the next candidate.`);
      lastFailure = { ok: false as const, msg: transient };
      continue;
    }

    if (!response.ok || isTokenError(response.status, body)) {
      return {
        ok: false,
        msg: describeApiFailure({ status: response.status, body, rejected, transient }).msg,
      };
    }

    resolvedPaths.set(cacheKey, path);
    return { ok: true, body };
  }

  return lastFailure;
};

/**
 * Poll until the job finishes, fails, or the window runs out.
 *
 * Rejects with an AbortError when the signal fires, so the caller can stay silent
 * about work it withdrew itself rather than reporting an error for it.
 */
export const pollInference = async (options: PollOptions): Promise<PollOutcome> => {
  const { signal, transient } = options;

  for (let attempt = 0; attempt < POLL_DELAYS_MS.length; attempt++) {
    await delay(POLL_DELAYS_MS[attempt], signal);
    if (signal?.aborted) {
      throw Object.assign(new Error("Polling aborted"), { name: "AbortError" });
    }

    const result = await pollOnce(options);
    if (!result.ok) return { status: "failed", msg: result.msg };

    const body = result.body;

    if (isStatus(body?.status, SUCCESS_STATUSES)) {
      const imageUrls = collectUrls(body);
      if (imageUrls.length > 0) return { status: "finished", imageUrls };
      // A success status with nothing to download is a contract divergence the
      // server cannot see, because from its side this poll returned 200.
      console.warn("Poll reported success but carried no result URLs:", body);
      return { status: "failed", msg: transient };
    }

    if (isStatus(body?.status, FAILURE_STATUSES)) {
      return { status: "failed", msg: readApiText(body) || transient };
    }

    if (!isStatus(body?.status, IN_FLIGHT_STATUSES)) {
      // Unknown vocabulary: keep polling rather than fail. Warned because nothing
      // server-side records that the plugin did not recognise the word.
      console.warn("Unrecognised poll status; still polling:", body?.status, body);
    }
  }

  return {
    status: "timed-out",
    msg: "This is taking longer than expected. Check your Picsart account — the job may still finish, and it has already been charged.",
  };
};

export { isAbortError };
export default pollInference;
