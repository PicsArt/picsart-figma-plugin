// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshBalance: vi.fn(() => Promise.resolve()),
  windowOpen: vi.fn(),
}));

vi.mock("@api/index", () => ({ refreshBalance: mocks.refreshBalance }));

import useBalanceRecovery from "../useBalanceRecovery";

const KEY = "test-api-key";

const returnToPlugin = (via: "focus" | "visibilitychange") =>
  act(() => {
    if (via === "focus") {
      window.dispatchEvent(new Event("focus"));
    } else {
      document.dispatchEvent(new Event("visibilitychange"));
    }
  });

beforeEach(() => {
  mocks.refreshBalance.mockClear();
  mocks.refreshBalance.mockImplementation(() => Promise.resolve());
  vi.stubGlobal("open", mocks.windowOpen);
  mocks.windowOpen.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useBalanceRecovery", () => {
  it("re-reads the balance when the user comes back after being sent to pricing", async () => {
    const { result } = renderHook(() => useBalanceRecovery(KEY, true));

    await act(async () => result.current.openPricing());
    expect(mocks.windowOpen).toHaveBeenCalled();
    mocks.refreshBalance.mockClear();

    await returnToPlugin("focus");

    expect(mocks.refreshBalance).toHaveBeenCalledWith(KEY);
  });

  it("also recovers through visibilitychange, since focus is not guaranteed", async () => {
    const { result } = renderHook(() => useBalanceRecovery(KEY, true));
    await act(async () => result.current.openPricing());
    mocks.refreshBalance.mockClear();

    await returnToPlugin("visibilitychange");

    expect(mocks.refreshBalance).toHaveBeenCalledWith(KEY);
  });

  it("re-reads the balance on the way out too, not only on the way back", async () => {
    const { result } = renderHook(() => useBalanceRecovery(KEY, true));

    await act(async () => result.current.openPricing());

    expect(mocks.refreshBalance).toHaveBeenCalledWith(KEY);
  });

  it("re-reads on return whenever the panel is blocked, with no click at all", async () => {
    renderHook(() => useBalanceRecovery(KEY, true));

    await returnToPlugin("focus");

    expect(mocks.refreshBalance).toHaveBeenCalledWith(KEY);
  });

  it("stays quiet on return when the panel has credits and no top-up is outstanding", async () => {
    renderHook(() => useBalanceRecovery(KEY, false));

    await returnToPlugin("focus");

    expect(mocks.refreshBalance).not.toHaveBeenCalled();
  });

  it("does not run two reads at once", async () => {
    let release: () => void = () => undefined;
    mocks.refreshBalance.mockImplementation(
      () => new Promise<void>((resolve) => (release = resolve))
    );
    const { result } = renderHook(() => useBalanceRecovery(KEY, true));

    act(() => result.current.recheck());
    act(() => result.current.recheck());
    expect(mocks.refreshBalance).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
    act(() => result.current.recheck());
    expect(mocks.refreshBalance).toHaveBeenCalledTimes(2);
  });

  it("does not try to read a balance with no key to read it with", async () => {
    renderHook(() => useBalanceRecovery("", true));

    await returnToPlugin("focus");

    expect(mocks.refreshBalance).not.toHaveBeenCalled();
  });

  it("recovers from a failed read rather than latching in flight forever", async () => {
    mocks.refreshBalance.mockImplementation(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useBalanceRecovery(KEY, true));

    await act(async () => {
      result.current.recheck();
    });

    mocks.refreshBalance.mockImplementation(() => Promise.resolve());
    act(() => result.current.recheck());

    expect(mocks.refreshBalance).toHaveBeenCalledTimes(2);
  });
});
