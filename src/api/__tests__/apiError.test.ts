import { describe, expect, it } from "vitest";
import {
  describeApiFailure,
  isRetryableStatus,
  isTokenError,
  readApiText,
  sanitizeApiDetail,
} from "@api/apiError";
import {
  KEY_WRONG_ERR,
  UPSCALE_FAILED_ERR,
  UPSCALE_REJECTED_ERR,
} from "@constants/index";

// The exact body the upscale endpoint answers with when the requested factor
// would push the result past its megapixel ceiling.
const UPSCALE_422 = {
  status: "error",
  message: "Validation Failed",
  detail:
    "image_url has wrong value https://cdn.picsart.io/9c7b6396-aa5e-4a4a-a28c-d08b0e8e437a.jpeg: Target image resolution would exceed 23MP after 2x upscale. Input image (2592x3456) would produce 35831808 pixels output.",
};

const REASON =
  "Target image resolution would exceed 23MP after 2x upscale. Input image (2592x3456) would produce 35831808 pixels output.";

describe("sanitizeApiDetail", () => {
  it("drops the field name and the CDN URL the user never saw", () => {
    expect(sanitizeApiDetail(UPSCALE_422.detail)).toBe(REASON);
  });

  it("keeps colons that belong to the reason itself", () => {
    expect(
      sanitizeApiDetail("image_url has wrong value https://cdn.picsart.io/x.jpeg: too big: 40MP")
    ).toBe("too big: 40MP");
  });

  it("strips the prefix for any field, not just image_url", () => {
    expect(sanitizeApiDetail("upscale_factor has wrong value 8: out of range")).toBe(
      "out of range"
    );
  });

  it("strips the prefix when the rejected value was empty", () => {
    expect(sanitizeApiDetail("prompt has wrong value : must not be empty")).toBe(
      "must not be empty"
    );
  });

  it("leaves a detail that has no such prefix untouched", () => {
    expect(sanitizeApiDetail("Image resolution is too high")).toBe(
      "Image resolution is too high"
    );
  });

  it("leaves the detail alone when the rejected value contains whitespace", () => {
    const detail = "scale has wrong value fit inside: unsupported";
    expect(sanitizeApiDetail(detail)).toBe(detail);
  });
});

describe("isRetryableStatus", () => {
  // The whole point of the classification: a repeat of a 4xx buys the user
  // another wait and the same answer.
  it.each([400, 401, 403, 413, 415, 422])("treats %i as not retryable", (status) => {
    expect(isRetryableStatus(status)).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])("treats %i as retryable", (status) => {
    expect(isRetryableStatus(status)).toBe(true);
  });
});

describe("readApiText", () => {
  it("prefers detail over the message category", () => {
    expect(readApiText(UPSCALE_422)).toBe(REASON);
  });

  it("falls back to a message that actually describes something", () => {
    expect(readApiText({ message: "Insufficient credits" })).toBe("Insufficient credits");
  });

  it("never surfaces the machine-readable token_error as prose", () => {
    expect(readApiText({ message: "token_error" })).toBeNull();
  });

  // "Validation Failed" names the category and nothing else. The per-tool
  // fallback tells the user which setting to change, so it wins.
  it("does not pass a bare category message off as an explanation", () => {
    expect(readApiText({ message: "Validation Failed" })).toBeNull();
  });

  it("ignores a non-string detail instead of stringifying it", () => {
    expect(readApiText({ detail: { field: "image_url" } })).toBeNull();
  });

  it("survives a body that could not be parsed", () => {
    expect(readApiText(null)).toBeNull();
  });
});

describe("describeApiFailure", () => {
  it("reports the API's reason for a 422 and marks it non-retryable", () => {
    expect(describeApiFailure({
      status: 422,
      body: UPSCALE_422,
      rejected: UPSCALE_REJECTED_ERR,
      transient: UPSCALE_FAILED_ERR,
    })).toEqual({ success: false, msg: REASON, retryable: false });
  });

  it("never tells the user to try again after a 4xx with no reason given", () => {
    const failure = describeApiFailure({
      status: 400,
      body: null,
      rejected: UPSCALE_REJECTED_ERR,
      transient: UPSCALE_FAILED_ERR,
    });
    expect(failure.msg).toBe(UPSCALE_REJECTED_ERR);
    expect(failure.msg).not.toMatch(/try again/i);
    expect(failure.retryable).toBe(false);
  });

  it("does offer a retry for a 500 with no reason given", () => {
    expect(describeApiFailure({
      status: 500,
      body: null,
      rejected: UPSCALE_REJECTED_ERR,
      transient: UPSCALE_FAILED_ERR,
    })).toEqual({ success: false, msg: UPSCALE_FAILED_ERR, retryable: true });
  });

  it("turns a 401 into the wrong-key message, not the raw token_error", () => {
    const failure = describeApiFailure({
      status: 401,
      body: { message: "token_error" },
      rejected: UPSCALE_REJECTED_ERR,
      transient: UPSCALE_FAILED_ERR,
    });
    expect(failure.msg).toBe(KEY_WRONG_ERR);
    expect(failure.retryable).toBe(false);
  });

  it("recognises a token error the API reports with a non-401 status", () => {
    expect(isTokenError(200, { message: "token_error" })).toBe(true);
    expect(isTokenError(422, UPSCALE_422)).toBe(false);
  });
});
