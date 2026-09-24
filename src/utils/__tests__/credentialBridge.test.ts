// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TYPE_CREDENTIAL, TYPE_REFRESH_CREDENTIAL } from "@constants/index";

const mocks = vi.hoisted(() => ({ sendMessageToSandBox: vi.fn() }));
vi.mock("@api/index", () => ({ sendMessageToSandBox: mocks.sendMessageToSandBox }));

import { requestCredentialRefresh } from "../credentialBridge";

const requestIdOf = (): string => {
  const call = mocks.sendMessageToSandBox.mock.calls.find(
    (c) => c[2] === TYPE_REFRESH_CREDENTIAL
  );
  return (call?.[4] as { requestId: string }).requestId;
};

const post = (message: Record<string, unknown>) =>
  window.dispatchEvent(
    new MessageEvent("message", { data: { pluginMessage: message } })
  );

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("requestCredentialRefresh", () => {
  it("resolves with the credential carrying its own requestId", async () => {
    const pending = requestCredentialRefresh();
    const requestId = requestIdOf();

    post({
      type: TYPE_CREDENTIAL,
      requestId,
      payload: { credential: { kind: "oauth", token: "fresh" }, apiKey: "" },
    });

    await expect(pending).resolves.toEqual({ kind: "oauth", token: "fresh" });
  });

  it("ignores an unsolicited credential post, which every panel open sends", async () => {
    vi.useFakeTimers();
    const pending = requestCredentialRefresh();
    const requestId = requestIdOf();

    post({
      type: TYPE_CREDENTIAL,
      payload: { credential: { kind: "oauth", token: "stale" }, apiKey: "" },
    });
    post({
      type: TYPE_CREDENTIAL,
      requestId: "cred-999",
      payload: { credential: { kind: "oauth", token: "someone-elses" }, apiKey: "" },
    });

    post({
      type: TYPE_CREDENTIAL,
      requestId,
      payload: { credential: { kind: "oauth", token: "mine" }, apiKey: "" },
    });

    await expect(pending).resolves.toEqual({ kind: "oauth", token: "mine" });
  });

  it("resolves null on a reply that carries no credential", async () => {
    const pending = requestCredentialRefresh();
    post({
      type: TYPE_CREDENTIAL,
      requestId: requestIdOf(),
      payload: { credential: null, apiKey: "" },
    });
    await expect(pending).resolves.toBeNull();
  });

  it("resolves null on a timeout rather than rejecting", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const pending = requestCredentialRefresh();
    await vi.advanceTimersByTimeAsync(20_001);

    await expect(pending).resolves.toBeNull();
  });

  it("gives each request its own id, so two in flight cannot cross", async () => {
    const first = requestCredentialRefresh();
    const second = requestCredentialRefresh();

    const ids = mocks.sendMessageToSandBox.mock.calls
      .filter((c) => c[2] === TYPE_REFRESH_CREDENTIAL)
      .map((c) => (c[4] as { requestId: string }).requestId);

    expect(new Set(ids).size).toBe(2);

    post({
      type: TYPE_CREDENTIAL,
      requestId: ids[1],
      payload: { credential: { kind: "oauth", token: "b" }, apiKey: "" },
    });
    post({
      type: TYPE_CREDENTIAL,
      requestId: ids[0],
      payload: { credential: { kind: "oauth", token: "a" }, apiKey: "" },
    });

    await expect(first).resolves.toEqual({ kind: "oauth", token: "a" });
    await expect(second).resolves.toEqual({ kind: "oauth", token: "b" });
  });

  it("detaches its listener once settled", async () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");

    const pending = requestCredentialRefresh();
    post({
      type: TYPE_CREDENTIAL,
      requestId: requestIdOf(),
      payload: { credential: null, apiKey: "" },
    });
    await pending;

    expect(added).toHaveBeenCalledTimes(1);
    expect(removed).toHaveBeenCalledTimes(1);
    added.mockRestore();
    removed.mockRestore();
  });
});
