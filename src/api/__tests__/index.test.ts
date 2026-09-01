import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiFailure } from "@api/apiError";
import {
  KEY_WRONG_ERR,
  REMOVE_BG_FAILED_ERR,
  REMOVE_BG_REJECTED_ERR,
  UPSCALE_FAILED_ERR,
  UPSCALE_REJECTED_ERR,
  GENERATE_IMAGE_FAILED_ERR,
} from "@constants/index";

// getImageBinary decodes through `new Image()`, which never fires onload for a
// blob URL outside a real browser. The upload path is not what these tests are
// about, so it is stubbed out; imageTypeOf is pure and tested for real.
vi.mock("@utils/imageBinary", () => ({
  default: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
  getImageBinary: vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })),
  imageTypeOf: () => ({ mime: "image/png", extension: "png" }),
}));

const UPSCALE_422_BODY = {
  status: "error",
  message: "Validation Failed",
  detail:
    "image_url has wrong value https://cdn.picsart.io/9c7b6396-aa5e-4a4a-a28c-d08b0e8e437a.jpeg: Target image resolution would exceed 23MP after 2x upscale. Input image (2592x3456) would produce 35831808 pixels output.",
};

const REASON =
  "Target image resolution would exceed 23MP after 2x upscale. Input image (2592x3456) would produce 35831808 pixels output.";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const bytes = () => new Uint8Array([1, 2, 3]);

/** One fetch answer for the API call, so a result download would be a second call. */
const answerWith = (response: Response) => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
    async () => response
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

/**
 * Narrows the discriminated union these calls return, and asserts the failure at
 * the same time — `retryable` only exists on the failure member.
 */
const asFailure = (result: { success: boolean }): ApiFailure => {
  expect(result.success).toBe(false);
  return result as ApiFailure;
};

describe("enhanceImage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // The reported bug: a 422 threw on `res.data.url` inside the call's own try
  // block, so the user was shown "Cannot read properties of undefined (reading
  // 'url')" — or, once the UI replaced it, "please try again" for a request that
  // cannot ever succeed.
  it("reports the API's own reason for a 422 instead of a TypeError", async () => {
    answerWith(jsonResponse(UPSCALE_422_BODY, 422));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result.success).toBe(false);
    expect(result.msg).toBe(REASON);
    expect(result.msg).not.toMatch(/undefined/);
  });

  it("does not invite a retry that would be charged for nothing", async () => {
    answerWith(jsonResponse(UPSCALE_422_BODY, 422));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(asFailure(result).retryable).toBe(false);
    expect(result.msg).not.toMatch(/try again/i);
  });

  it("never fetches a result URL from an error body", async () => {
    const fetchMock = answerWith(jsonResponse(UPSCALE_422_BODY, 422));
    const { enhanceImage } = await import("@api/index");

    await enhanceImage(bytes(), "key", 2, "PNG");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("offers a retry for a 503", async () => {
    answerWith(jsonResponse({ status: "error" }, 503));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result).toMatchObject({ success: false, msg: UPSCALE_FAILED_ERR, retryable: true });
  });

  it("falls back to the rejected wording for a 4xx with no usable reason", async () => {
    answerWith(jsonResponse({ status: "error", message: "Validation Failed" }, 422));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result.msg).toBe(UPSCALE_REJECTED_ERR);
  });

  it("surfaces a bad key as the wrong-key message", async () => {
    answerWith(jsonResponse({ message: "token_error" }, 401));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result.msg).toBe(KEY_WRONG_ERR);
  });

  it("treats an HTML error page as a transient failure, not a crash", async () => {
    answerWith(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result).toMatchObject({ success: false, msg: UPSCALE_FAILED_ERR, retryable: true });
  });

  it("does not leak a thrown fetch's message to the user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result.msg).toBe(UPSCALE_FAILED_ERR);
  });

  it("still returns the bytes and the credit header on success", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { url: "https://cdn.picsart.io/out.png" } }), {
          status: 200,
          headers: { "content-type": "application/json", "x-picsart-credit-available": "42" },
        })
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([9, 9, 9]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    if (!result.success) throw new Error(`expected success, got: ${result.msg}`);
    expect(result.msg).toEqual(new Uint8Array([9, 9, 9]));
    expect(result.updatedCredits).toBe(42);
  });

  it("reports a 200 that carries no result URL rather than throwing", async () => {
    answerWith(jsonResponse({ status: "success" }, 200));
    const { enhanceImage } = await import("@api/index");

    const result = await enhanceImage(bytes(), "key", 2, "PNG");

    expect(result).toMatchObject({ success: false, msg: UPSCALE_FAILED_ERR });
  });

  it("sends the format the caller asked for", async () => {
    const fetchMock = answerWith(jsonResponse(UPSCALE_422_BODY, 422));
    const { enhanceImage } = await import("@api/index");

    await enhanceImage(bytes(), "key", 4, "PNG");

    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get("format")).toBe("PNG");
    expect(body.get("upscale_factor")).toBe("4");
  });
});

describe("removeBackgroundApi", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a 422 reason instead of a TypeError", async () => {
    answerWith(jsonResponse(
      { status: "error", detail: "bg_color has wrong value zzz: unknown colour" },
      422
    ));
    const { removeBackgroundApi } = await import("@api/index");

    const result = await removeBackgroundApi(bytes(), "key");

    expect(asFailure(result)).toEqual({ success: false, msg: "unknown colour", retryable: false });
  });

  it("falls back to the rejected wording for a 4xx with no detail", async () => {
    answerWith(jsonResponse({}, 400));
    const { removeBackgroundApi } = await import("@api/index");

    expect((await removeBackgroundApi(bytes(), "key")).msg).toBe(REMOVE_BG_REJECTED_ERR);
  });

  it("offers a retry for a 500", async () => {
    answerWith(jsonResponse({}, 500));
    const { removeBackgroundApi } = await import("@api/index");

    expect((await removeBackgroundApi(bytes(), "key")).msg).toBe(REMOVE_BG_FAILED_ERR);
  });
});

describe("generateImage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the API's reason for a rejected prompt", async () => {
    answerWith(jsonResponse(
      { status: "error", message: "Validation Failed", detail: "prompt has wrong value : must not be empty" },
      422
    ));
    const { generateImage } = await import("@api/index");

    const result = await generateImage("x", "key", { width: 1024, height: 1024, style: "" });

    expect(result.msg).toBe("must not be empty");
  });

  it("no longer hands the raw token_error to the notification", async () => {
    answerWith(jsonResponse({ message: "token_error" }, 401));
    const { generateImage } = await import("@api/index");

    const result = await generateImage("x", "key", { width: 1024, height: 1024, style: "" });

    expect(result.msg).toBe(KEY_WRONG_ERR);
  });

  it("still accepts a 202 with an inference id", async () => {
    answerWith(jsonResponse({ status: "processing", inference_id: "abc" }, 202));
    const { generateImage } = await import("@api/index");

    const result = await generateImage("x", "key", { width: 1024, height: 1024, style: "" });

    expect(result).toMatchObject({ success: true, inferenceId: "abc" });
  });
});

describe("checkGenerateImageStatus", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not report a bare status word as the failure message", async () => {
    answerWith(jsonResponse({ status: "failed" }, 200));
    const { checkGenerateImageStatus } = await import("@api/index");

    const result = await checkGenerateImageStatus("abc", "key");

    expect(result).toEqual({ status: "failed", msg: GENERATE_IMAGE_FAILED_ERR });
  });

  it("sanitizes the reason a failed inference gives", async () => {
    answerWith(jsonResponse(
      { status: "failed", detail: "image_url has wrong value https://cdn.picsart.io/a.png: unsupported aspect ratio" },
      200
    ));
    const { checkGenerateImageStatus } = await import("@api/index");

    expect((await checkGenerateImageStatus("abc", "key")).msg).toBe("unsupported aspect ratio");
  });

  it("turns a 401 during polling into the wrong-key message", async () => {
    answerWith(jsonResponse({ message: "token_error" }, 401));
    const { checkGenerateImageStatus } = await import("@api/index");

    expect(await checkGenerateImageStatus("abc", "key")).toEqual({
      status: "error",
      msg: KEY_WRONG_ERR,
    });
  });

  it("still returns finished image URLs", async () => {
    answerWith(jsonResponse(
      { status: "success", data: [{ id: "1", url: "https://cdn.picsart.io/1.png", status: "success" }] },
      200
    ));
    const { checkGenerateImageStatus } = await import("@api/index");

    expect(await checkGenerateImageStatus("abc", "key")).toMatchObject({
      status: "FINISHED",
      imageUrls: ["https://cdn.picsart.io/1.png"],
    });
  });

  it("lets an abort keep propagating instead of reporting it as a failure", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw abort; },
    })));
    const { checkGenerateImageStatus, isAbortError } = await import("@api/index");

    await expect(checkGenerateImageStatus("abc", "key")).rejects.toBe(abort);
    expect(isAbortError(abort)).toBe(true);
  });
});
