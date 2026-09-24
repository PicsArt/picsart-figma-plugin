import { describe, expect, it } from "vitest";
import {
  classifyTokenFailure,
  describeApiFailure,
  isRetryableStatus,
  isTokenError,
  mayReceiveCredential,
  readApiText,
  sanitizeApiDetail,
} from "@api/apiError";
import {
  BEARER_REJECTED_ERR,
  KEY_WRONG_ERR,
  SESSION_EXPIRED_ERR,
  SESSION_SCOPE_ERR,
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

describe("classifyTokenFailure", () => {
  it("calls an API key a wrong key", () => {
    expect(classifyTokenFailure({ kind: "apikey", token: "k" })).toBe("wrong-key");
  });

  it("calls no credential at all a wrong key, rather than throwing", () => {
    expect(classifyTokenFailure()).toBe("wrong-key");
  });

  it("calls a first bearer 401 an expired session when the expiry is not known", () => {
    expect(
      classifyTokenFailure({ kind: "oauth", token: "t", scopes: ["workflows.execute"] })
    ).toBe("session-expired");
  });

  it("refuses to call a token that is still in date expired", () => {
    expect(
      classifyTokenFailure({
        kind: "oauth",
        token: "t",
        scopes: ["workflows.execute"],
        expiresAt: Date.now() + 60_000,
      })
    ).toBe("bearer-rejected");
  });

  it("still calls a token that IS past its expiry an expired session", () => {
    expect(
      classifyTokenFailure({
        kind: "oauth",
        token: "t",
        scopes: ["workflows.execute"],
        expiresAt: Date.now() - 1,
      })
    ).toBe("session-expired");
  });

  it("calls a second 401 after a refresh a rejected bearer, not another expiry", () => {
    expect(
      classifyTokenFailure({
        kind: "oauth",
        token: "t",
        scopes: ["workflows.execute"],
        refreshed: true,
      })
    ).toBe("bearer-rejected");
  });

  it("checks the missing scope BEFORE expiry, because a refresh reissues the same scopes", () => {
    expect(
      classifyTokenFailure({ kind: "oauth", token: "t", scopes: ["openid", "profile"] })
    ).toBe("missing-scope");
  });

  it("does not claim a missing scope for a token whose scopes were never read", () => {
    expect(classifyTokenFailure({ kind: "oauth", token: "t" })).toBe("session-expired");
  });
});

describe("describeApiFailure on a 401", () => {
  const failure = (credential?: Parameters<typeof classifyTokenFailure>[0]) =>
    describeApiFailure({
      status: 401,
      body: { message: "token_error", detail: "User token was not provided or is invalid" },
      rejected: UPSCALE_REJECTED_ERR,
      transient: UPSCALE_FAILED_ERR,
      credential,
    });

  it("keeps the wrong-key wording and terminal verdict for an API key", () => {
    expect(failure({ kind: "apikey", token: "k" })).toEqual({
      success: false,
      msg: KEY_WRONG_ERR,
      retryable: false,
      tokenFailure: "wrong-key",
    });
  });

  it("marks an expired session retryable — the one 4xx a later attempt survives", () => {
    expect(failure({ kind: "oauth", token: "t", scopes: ["workflows.execute"] })).toEqual({
      success: false,
      msg: SESSION_EXPIRED_ERR,
      retryable: true,
      tokenFailure: "session-expired",
    });
  });

  it("offers a retry for a token past its expiry, and not for one still in date", () => {
    expect(
      failure({
        kind: "oauth",
        token: "t",
        scopes: ["workflows.execute"],
        expiresAt: Date.now() - 1,
      })
    ).toMatchObject({ msg: SESSION_EXPIRED_ERR, retryable: true });

    expect(
      failure({
        kind: "oauth",
        token: "t",
        scopes: ["workflows.execute"],
        expiresAt: Date.now() + 60_000,
      })
    ).toMatchObject({ msg: BEARER_REJECTED_ERR, retryable: false });
  });

  it("does not offer a retry for a missing scope or a rejected bearer", () => {
    expect(failure({ kind: "oauth", token: "t", scopes: [] })).toMatchObject({
      msg: SESSION_SCOPE_ERR,
      retryable: false,
    });
    expect(
      failure({ kind: "oauth", token: "t", scopes: ["workflows.execute"], refreshed: true })
    ).toMatchObject({ msg: BEARER_REJECTED_ERR, retryable: false });
  });

  it("prefers the local classification over the API's own sentence", () => {
    expect(failure({ kind: "apikey", token: "k" }).msg).not.toContain("User token");
  });
});

describe("mayReceiveCredential", () => {
  it("permits the API hosts and the auth host", () => {
    expect(mayReceiveCredential("https://api.picsart.io/v1/balance")).toBe(true);
    expect(mayReceiveCredential("https://genai-api.picsart.io/v1/figma/text2image")).toBe(true);
    expect(mayReceiveCredential("https://auth.picsart.com/api/oauth2/token")).toBe(true);
  });

  it("refuses the result CDNs, which is why RESULT_HOST_ALLOWLIST cannot be reused", () => {
    expect(mayReceiveCredential("https://cdn.picsart.io/abc.png")).toBe(false);
    expect(mayReceiveCredential("https://aicdn.picsart.com/abc.png")).toBe(false);
    expect(mayReceiveCredential("https://project-files.picsart.com/abc.png")).toBe(false);
    expect(mayReceiveCredential("https://accounts.picsart.com/")).toBe(false);
  });

  it("is not fooled by a lookalike hostname", () => {
    expect(mayReceiveCredential("https://api.picsart.io.evil.test/v1/balance")).toBe(false);
  });
});
