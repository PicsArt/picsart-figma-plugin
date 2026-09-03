import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialDescriptor } from "@app-types/credential";
import {
  BEARER_REJECTED_ERR,
  EDIT_IMAGE_FAILED_ERR,
  EDIT_IMAGE_REJECTED_ERR,
  KEY_WRONG_ERR,
  SESSION_EXPIRED_ERR,
} from "@constants/index";
import { pollInference, type PollOptions } from "../pollInference";

const PATHS = ["figma/painting/"] as const;

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const PROCESSING = respond(200, { status: "processing" });
const DONE = respond(200, {
  status: "success",
  data: [{ url: "https://cdn.picsart.io/a.png" }],
});
const UNAUTHORIZED = respond(401, { message: "token_error" });

const fetchMock = vi.fn();

const sentCredential = (call: number): string | undefined => {
  const headers = (fetchMock.mock.calls[call]?.[1]?.headers ?? {}) as Record<string, string>;
  return headers["Authorization"] ?? headers["X-Picsart-API-Key"];
};

const options = (
  over: Partial<PollOptions> & Pick<PollOptions, "credential">
): PollOptions => ({
  paths: PATHS,
  inferenceId: "inf-1",
  transient: EDIT_IMAGE_FAILED_ERR,
  rejected: EDIT_IMAGE_REJECTED_ERR,
  ...over,
});

const runTicks = async (count: number) => {
  for (let i = 0; i < count; i++) await vi.advanceTimersByTimeAsync(20_000);
};

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the credential is read per tick, not captured once", () => {
  it("asks the provider again on every tick", async () => {
    fetchMock.mockResolvedValueOnce(PROCESSING).mockResolvedValueOnce(DONE);
    const tokens = ["first-token", "second-token"];
    const credential = vi.fn(
      (): CredentialDescriptor => ({ kind: "oauth", token: tokens.shift() ?? "exhausted" })
    );

    const outcome = pollInference(options({ credential }));
    await runTicks(2);

    await expect(outcome).resolves.toMatchObject({ status: "finished" });
    expect(credential).toHaveBeenCalledTimes(2);
    expect(sentCredential(0)).toBe("Bearer first-token");
    expect(sentCredential(1)).toBe("Bearer second-token");
  });

  it("still accepts a plain string, which is what every caller passes today", async () => {
    fetchMock.mockResolvedValue(DONE);

    const outcome = pollInference(options({ credential: "test-api-key" }));
    await runTicks(1);

    await expect(outcome).resolves.toMatchObject({ status: "finished" });
    expect(sentCredential(0)).toBe("test-api-key");
  });
});

describe("a 401 mid-poll", () => {
  it("ends the job with the wrong-key message for an API key", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);

    const outcome = pollInference(options({ credential: "test-api-key" }));
    await runTicks(1);

    await expect(outcome).resolves.toEqual({ status: "failed", msg: KEY_WRONG_ERR });
  });

  it("does not call an expired session a wrong API key", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);

    const outcome = pollInference(
      options({ credential: { kind: "oauth", token: "t", scopes: ["workflows.execute"] } })
    );
    await runTicks(1);

    await expect(outcome).resolves.toEqual({ status: "failed", msg: SESSION_EXPIRED_ERR });
  });

  it("refreshes and retries within the same tick", async () => {
    fetchMock.mockResolvedValueOnce(UNAUTHORIZED).mockResolvedValueOnce(DONE);
    let refreshed = false;
    const credential = (): CredentialDescriptor => ({
      kind: "oauth",
      token: refreshed ? "fresh" : "stale",
      scopes: ["workflows.execute"],
      refreshed,
    });
    const refresh = vi.fn(async () => {
      refreshed = true;
      return true;
    });

    const outcome = pollInference(options({ credential, refresh }));
    await runTicks(1);

    await expect(outcome).resolves.toMatchObject({ status: "finished" });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentCredential(0)).toBe("Bearer stale");
    expect(sentCredential(1)).toBe("Bearer fresh");
  });

  it("stops after one refresh, and says the bearer was rejected rather than expired", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);
    let refreshed = false;
    const credential = (): CredentialDescriptor => ({
      kind: "oauth",
      token: "t",
      scopes: ["workflows.execute"],
      refreshed,
    });
    const refresh = vi.fn(async () => {
      refreshed = true;
      return true;
    });

    const outcome = pollInference(options({ credential, refresh }));
    await runTicks(1);

    await expect(outcome).resolves.toEqual({ status: "failed", msg: BEARER_REJECTED_ERR });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("reports the token failure when the refresh itself fails", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);
    const refresh = vi.fn(async () => false);

    const outcome = pollInference(
      options({
        credential: { kind: "oauth", token: "t", scopes: ["workflows.execute"] },
        refresh,
      })
    );
    await runTicks(1);

    await expect(outcome).resolves.toEqual({ status: "failed", msg: SESSION_EXPIRED_ERR });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats a thrown refresh as a failed one rather than failing the poll with it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(UNAUTHORIZED);
    const refresh = vi.fn(async () => {
      throw new Error("storage exploded");
    });

    const outcome = pollInference(
      options({
        credential: { kind: "oauth", token: "t", scopes: ["workflows.execute"] },
        refresh,
      })
    );
    await runTicks(1);

    await expect(outcome).resolves.toEqual({ status: "failed", msg: SESSION_EXPIRED_ERR });
    error.mockRestore();
  });
});

describe("refresh is single-flight", () => {
  it("collapses two concurrent polls onto one refresh", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);

    let release: (ok: boolean) => void = () => undefined;
    const pending = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    const refresh = vi.fn(() => pending);
    const credential: CredentialDescriptor = {
      kind: "oauth",
      token: "t",
      scopes: ["workflows.execute"],
    };

    const first = pollInference(options({ credential, refresh, inferenceId: "job-1" }));
    const second = pollInference(options({ credential, refresh, inferenceId: "job-2" }));
    await runTicks(1);

    expect(refresh).toHaveBeenCalledTimes(1);

    release(false);
    await expect(first).resolves.toMatchObject({ msg: SESSION_EXPIRED_ERR });
    await expect(second).resolves.toMatchObject({ msg: SESSION_EXPIRED_ERR });
  });

  it("allows a later refresh once the first has settled", async () => {
    fetchMock.mockResolvedValue(UNAUTHORIZED);
    const refresh = vi.fn(async () => false);
    const credential: CredentialDescriptor = {
      kind: "oauth",
      token: "t",
      scopes: ["workflows.execute"],
    };

    const first = pollInference(options({ credential, refresh, inferenceId: "job-1" }));
    await runTicks(1);
    await first;

    const second = pollInference(options({ credential, refresh, inferenceId: "job-2" }));
    await runTicks(1);
    await second;

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
