import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editImage } from "../index";
import {
  CORS_SAFE_REQUEST_HEADERS,
  EDIT_IMAGE_FAILED_ERR,
  EDIT_IMAGE_REJECTED_ERR,
  KEY_WRONG_ERR,
  UNSUPPORTED_MEDIA_ERR,
} from "@constants/index";
import type { PreparedSource } from "@utils/imageBinary";

/**
 * The endpoint's two unknowns are what these tests exist for.
 *
 * `/painting/edit` documents `mode` defaulting to `sync`, deprecated in favour of the
 * `Prefer` header — so the plugin asks for async and must still cope if the `figma/`
 * proxy ignores that and answers 200 with the result inline. Whether it does is the
 * one thing no document settles, and a paid request whose result arrives "too early"
 * must not be discarded.
 */

const source: PreparedSource = {
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  extension: "png",
  width: 1024,
  height: 768,
  downscaled: false,
};

const KEY = "test-api-key";
const options = { prompt: "make it night", count: 2, format: "PNG", model: "" };

const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  }) as unknown as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

const lastRequest = () => fetchMock.mock.calls[0][1] as RequestInit;
const lastBody = () => lastRequest().body as FormData;

// editImage returns a union of two success shapes and a failure, so a `.msg` read has
// to narrow first. Throwing here rather than asserting makes a wrong-branch result
// fail loudly instead of reading undefined.
const failure = (result: Awaited<ReturnType<typeof editImage>>) => {
  if (result.success) throw new Error(`expected a failure, got ${JSON.stringify(result)}`);
  return result;
};

describe("editImage — the request", () => {
  it("asks for the async shape through the mode FIELD, never the Prefer header", async () => {
    // This is the CORS bug, pinned. `Prefer: respond-async` is the correct RFC 7240 way
    // to ask, and it is unusable here: the gateway's preflight does not list `prefer` in
    // Access-Control-Allow-Headers, so the iframe refuses to send the request and the
    // user gets a CORS error — while curl, node and this very test file sail through,
    // because none of them perform a preflight. A form field is invisible to CORS.
    fetchMock.mockResolvedValue(respond(202, { inference_id: "inf-1" }));

    await editImage(source, KEY, options);

    expect(lastBody().get("mode")).toBe("async");
    const headers = lastRequest().headers as Record<string, string>;
    expect(headers.Prefer).toBeUndefined();
  });

  it("sends no request header the gateway's CORS preflight would block", async () => {
    // The mechanical guard for the whole bug class. A header outside the allow-list
    // breaks this call in Figma and NOWHERE else — not in a test, not in curl — so
    // nothing but this assertion stands between the next added header and a plugin that
    // fails only in the product.
    fetchMock.mockResolvedValue(respond(202, { inference_id: "inf-1" }));

    await editImage(source, KEY, options);

    const sent = Object.keys((lastRequest().headers ?? {}) as Record<string, string>);
    const blocked = sent.filter(
      (h) => CORS_SAFE_REQUEST_HEADERS.indexOf(h.toLowerCase() as never) === -1
    );
    expect(blocked).toEqual([]);
  });

  it("sends only the parameters this endpoint accepts", async () => {
    // Its own request builder, not generateImage with conditionals. The Generate panel
    // also holds an aspect ratio, a style and a negative prompt; none of them belong
    // on this request, and a shared builder is how one ends up there.
    fetchMock.mockResolvedValue(respond(202, { inference_id: "inf-1" }));

    await editImage(source, KEY, options);

    const body = lastBody();
    // forEach rather than spreading body.keys(): tsconfig targets es5, so a
    // FormDataIterator cannot be spread without downlevelIteration.
    const keys: string[] = [];
    body.forEach((_value, key) => keys.push(key));
    expect(keys.sort()).toEqual(["count", "format", "image", "mode", "prompt"]);
    expect(body.get("prompt")).toBe("make it night");
    expect(body.get("count")).toBe("2");
    // Sent explicitly: the worker declares a lowercase `png` default and the published
    // spec declares uppercase `JPG`, so neither default can be relied on.
    expect(body.get("format")).toBe("PNG");
  });

  it("omits the model rather than sending it empty", async () => {
    fetchMock.mockResolvedValue(respond(202, { inference_id: "inf-1" }));

    await editImage(source, KEY, options);

    expect(lastBody().has("model")).toBe(false);
  });

  it("sends a chosen model", async () => {
    fetchMock.mockResolvedValue(respond(202, { inference_id: "inf-1" }));

    await editImage(source, KEY, { ...options, model: "urn:air:reve:model:reve:reve-edit@1" });

    expect(lastBody().get("model")).toBe("urn:air:reve:model:reve:reve-edit@1");
  });

  it("refuses an empty instruction without spending a request", async () => {
    const result = await editImage(source, KEY, { ...options, prompt: "   " });

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("editImage — 202, the requested path", () => {
  it("returns the inference id to poll with", async () => {
    fetchMock.mockResolvedValue(
      respond(202, { inference_id: "inf-7" }, { "x-picsart-credit-available": "88" })
    );

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ success: true, inferenceId: "inf-7", updatedCredits: 88 });
  });

  it("accepts transaction_id, which the older public reference documented", async () => {
    fetchMock.mockResolvedValue(respond(202, { transaction_id: "txn-3" }));

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ success: true, inferenceId: "txn-3" });
  });

  it("fails rather than silently succeeding when 202 carries no id", async () => {
    // Accepted, charged, and nothing to poll with. Invisible server-side, because from
    // its side this request succeeded — hence the warn.
    fetchMock.mockResolvedValue(respond(202, { status: "processing" }));

    const result = await editImage(source, KEY, options);

    expect(failure(result).msg).toBe(EDIT_IMAGE_FAILED_ERR);
  });
});

describe("editImage — 200, the synchronous fallback", () => {
  it("treats an inline result as a completed job, not as an error", async () => {
    // The whole reason this branch exists. The spec's default is sync, so if the proxy
    // ignores Prefer the result arrives here — and discarding it would throw away a
    // request the user has already paid for.
    fetchMock.mockResolvedValue(
      respond(200, {
        status: "success",
        data: [
          { id: "a", url: "https://cdn.picsart.io/a.png" },
          { id: "b", url: "https://cdn.picsart.io/b.png" },
        ],
      })
    );

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({
      success: true,
      inferenceId: undefined,
      imageUrls: ["https://cdn.picsart.io/a.png", "https://cdn.picsart.io/b.png"],
    });
  });

  it("fails when a 200 carries no result URLs at all", async () => {
    fetchMock.mockResolvedValue(respond(200, { status: "success", data: [] }));

    const result = await editImage(source, KEY, options);

    expect(result.success).toBe(false);
  });
});

describe("editImage — failures", () => {
  it("names a wrong key rather than echoing token_error", async () => {
    fetchMock.mockResolvedValue(respond(401, { message: "token_error" }));

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ success: false, msg: KEY_WRONG_ERR, retryable: false });
  });

  it("gives 415 its own sentence, since no retry changes the format", async () => {
    fetchMock.mockResolvedValue(respond(415, { detail: "unsupported" }));

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ success: false, msg: UNSUPPORTED_MEDIA_ERR, retryable: false });
  });

  it("shows the API's own reason for a rejected request, minus our field prefix", async () => {
    fetchMock.mockResolvedValue(
      respond(422, {
        detail: "image_url has wrong value https://cdn.picsart.io/x.jpeg: image is too small",
      })
    );

    const result = await editImage(source, KEY, options);

    // The field name and the CDN URL are ours — the user picked a Figma layer and
    // never saw either.
    expect(failure(result).msg).toBe("image is too small");
  });

  it("does not tell the user to try again after a 4xx", async () => {
    fetchMock.mockResolvedValue(respond(400, {}));

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ msg: EDIT_IMAGE_REJECTED_ERR, retryable: false });
    expect(failure(result).msg).not.toMatch(/try again/i);
  });

  it("does say try again after a 5xx", async () => {
    fetchMock.mockResolvedValue(respond(503, {}));

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ msg: EDIT_IMAGE_FAILED_ERR, retryable: true });
  });

  it("survives an HTML gateway page instead of reporting a network error", async () => {
    fetchMock.mockResolvedValue({
      status: 502,
      ok: false,
      headers: { get: () => null },
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    } as unknown as Response);

    const result = await editImage(source, KEY, options);

    expect(result).toMatchObject({ success: false, msg: EDIT_IMAGE_FAILED_ERR });
  });

  it("keeps a thrown fetch out of the user-facing message", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await editImage(source, KEY, options);

    // A raw error message is JS internals; the console keeps it.
    expect(failure(result).msg).toBe(EDIT_IMAGE_FAILED_ERR);
    expect(failure(result).msg).not.toContain("Failed to fetch");
  });
});

describe("the poll path fallback", () => {
  it("falls back to the published path when the proxied one 404s, then remembers it", async () => {
    // The published spec documents `painting/{id}` with no `figma/` prefix, while every
    // POST this plugin makes is proxied. Trying both costs one extra GET once — a poll is
    // not a billed call — and the answer is cached so it is not one per tick.
    const { pollInference } = await import("../pollInference");

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(respond(404, { detail: "not found" }))
      .mockResolvedValueOnce(
        respond(200, { status: "success", data: [{ url: "https://cdn.picsart.io/a.png" }] })
      );

    const outcome = await pollInference({
      paths: ["figma/painting/", "painting/"],
      inferenceId: "inf-1",
      credential: KEY,
      transient: EDIT_IMAGE_FAILED_ERR,
      rejected: EDIT_IMAGE_REJECTED_ERR,
    });

    expect(outcome).toEqual({
      status: "finished",
      imageUrls: ["https://cdn.picsart.io/a.png"],
    });
    expect(fetchMock.mock.calls[0][0]).toContain("figma/painting/inf-1");
    expect(fetchMock.mock.calls[1][0]).toContain("painting/inf-1");

    // Second job in the same session: only the remembered path is tried.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      respond(200, { status: "success", data: [{ url: "https://cdn.picsart.io/b.png" }] })
    );
    await pollInference({
      paths: ["figma/painting/", "painting/"],
      inferenceId: "inf-2",
      credential: KEY,
      transient: EDIT_IMAGE_FAILED_ERR,
      rejected: EDIT_IMAGE_REJECTED_ERR,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
