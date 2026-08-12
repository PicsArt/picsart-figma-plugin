import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addUiMessageHandler,
  beginUiSession,
  isUiReady,
  onUiReady,
  postToUi,
  removeUiMessageHandler,
  resetUiBridge,
} from "../UiBridge";
import { TYPE_UI_READY } from "../../constants/index";
import { makeFigmaStub } from "./figmaStub";

/**
 * The boot handshake is the part of this plugin that cannot be checked by the
 * compiler and cannot be seen when it breaks: a dropped message shows up as a blank
 * panel with no error, which CLAUDE.md names as the recurring bug of this codebase.
 * These tests are the substitute for being able to watch it in Figma.
 */

interface Posted {
  type?: string;
  [key: string]: unknown;
}

const makeApi = () => {
  const posted: Posted[] = [];
  const api = {
    ui: {
      postMessage: (msg: Posted) => posted.push(msg),
      onmessage: undefined as unknown,
    },
  } as unknown as PluginAPI;
  return { api, posted };
};

/** Impersonate the UI announcing itself through the installed dispatcher. */
const sendFromUi = (api: PluginAPI, message: Posted) =>
  (api.ui.onmessage as (m: Posted) => unknown)(message);

describe("UiBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetUiBridge();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetUiBridge();
  });

  it("holds messages until the UI reports ready, then sends them in order", () => {
    const { api, posted } = makeApi();
    beginUiSession(api);

    postToUi(api, { type: "first" });
    postToUi(api, { type: "second" });
    // This is what the 400ms guess was protecting against, except it guessed.
    expect(posted).toEqual([]);

    sendFromUi(api, { type: TYPE_UI_READY });

    // Order matters: the UI reads the key before it renders the tab.
    expect(posted.map((m) => m.type)).toEqual(["first", "second"]);
  });

  it("sends immediately once ready", () => {
    const { api, posted } = makeApi();
    beginUiSession(api);
    sendFromUi(api, { type: TYPE_UI_READY });

    postToUi(api, { type: "later" });
    expect(posted.map((m) => m.type)).toEqual(["later"]);
  });

  it("flushes on the fallback timer if the UI never reports ready", () => {
    // An older UI bundle, or a mount that throws, must not leave the panel blank
    // forever. The fallback reproduces the old timing exactly.
    const { api, posted } = makeApi();
    beginUiSession(api);
    postToUi(api, { type: "queued" });

    expect(posted).toEqual([]);
    vi.advanceTimersByTime(400);

    expect(posted.map((m) => m.type)).toEqual(["queued"]);
    expect(isUiReady()).toBe(true);
  });

  it("does not double-send when ready arrives and the timer would also fire", () => {
    const { api, posted } = makeApi();
    beginUiSession(api);
    postToUi(api, { type: "once" });

    sendFromUi(api, { type: TYPE_UI_READY });
    vi.advanceTimersByTime(1000);

    expect(posted.filter((m) => m.type === "once")).toHaveLength(1);
  });

  it("treats a new session as not-ready, because showUI reloads the iframe", () => {
    const { api, posted } = makeApi();
    beginUiSession(api);
    sendFromUi(api, { type: TYPE_UI_READY });
    expect(isUiReady()).toBe(true);

    // A tab switch calls showUI again; the React app remounts from scratch, so the
    // previous ready state is meaningless.
    beginUiSession(api);
    expect(isUiReady()).toBe(false);

    postToUi(api, { type: "after-switch" });
    expect(posted.map((m) => m.type)).toEqual([]);

    sendFromUi(api, { type: TYPE_UI_READY });
    expect(posted.map((m) => m.type)).toEqual(["after-switch"]);
  });

  it("drops messages queued for a session that was replaced", () => {
    const { api, posted } = makeApi();
    beginUiSession(api);
    postToUi(api, { type: "stale" });

    // Superseded before it ever went out: that iframe is gone.
    beginUiSession(api);
    sendFromUi(api, { type: TYPE_UI_READY });

    expect(posted).toEqual([]);
  });

  it("delivers to every registered handler, not just the last one", async () => {
    // The bug this exists to prevent: figma.ui.onmessage is one assignable slot, so
    // setMessageListeners silently destroyed RemoveBackgroundController's
    // key-validation handler.
    const { api } = makeApi();
    const first = vi.fn();
    const second = vi.fn();

    addUiMessageHandler(api, first);
    addUiMessageHandler(api, second);

    await sendFromUi(api, { type: "something" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("registers a given handler only once", async () => {
    const { api } = makeApi();
    const handler = vi.fn();

    addUiMessageHandler(api, handler);
    addUiMessageHandler(api, handler);
    addUiMessageHandler(api, handler);

    await sendFromUi(api, { type: "something" });

    // Otherwise every controller invocation stacks another copy and a single tab
    // switch applies its result two or three times.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes only the handler asked for", async () => {
    const { api } = makeApi();
    const keep = vi.fn();
    const drop = vi.fn();

    addUiMessageHandler(api, keep);
    addUiMessageHandler(api, drop);
    removeUiMessageHandler(drop);

    await sendFromUi(api, { type: "something" });

    expect(keep).toHaveBeenCalledTimes(1);
    expect(drop).not.toHaveBeenCalled();
  });

  it("keeps the ready signal out of the handlers", async () => {
    const { api } = makeApi();
    const handler = vi.fn();
    addUiMessageHandler(api, handler);
    beginUiSession(api);

    await sendFromUi(api, { type: TYPE_UI_READY });

    // It is bridge bookkeeping, not application traffic.
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs an onUiReady callback immediately when already ready", () => {
    const { api } = makeApi();
    beginUiSession(api);
    sendFromUi(api, { type: TYPE_UI_READY });

    const callback = vi.fn();
    onUiReady(api, callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("defers an onUiReady callback until ready, and runs it once", () => {
    const { api } = makeApi();
    beginUiSession(api);

    const callback = vi.fn();
    onUiReady(api, callback);
    expect(callback).not.toHaveBeenCalled();

    sendFromUi(api, { type: TYPE_UI_READY });
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("survives a message with no type", async () => {
    const { api } = makeApi();
    const handler = vi.fn();
    addUiMessageHandler(api, handler);

    await expect(sendFromUi(api, {})).resolves.not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

/**
 * The failure a real launch produced: a blank panel, nothing logged.
 *
 * A launch creates more than one iframe — `src/code.ts` shows a hidden UI, a controller
 * shows the real panel, and RemoveBackgroundController shows its own hidden one in
 * between. Each `showUI` replaces the iframe, but the replaced one lives long enough to
 * finish mounting and post its own ready signal.
 */
describe("UiBridge: more than one iframe per launch", () => {
  beforeEach(() => resetUiBridge());
  afterEach(() => resetUiBridge());

  it("re-delivers the boot burst when a second iframe reports ready", () => {
    const { api, posted } = makeFigmaStub();

    addUiMessageHandler(api, () => {});
    beginUiSession(api);
    postToUi(api, { type: "key", payload: "k" });
    postToUi(api, { type: "tab", payload: "Generate Image" });
    expect(posted).toHaveLength(0);

    // The hidden iframe finishes mounting and announces itself. Its ready signal arrives
    // after the session for the visible panel has begun, so the queue drains into an
    // iframe that has not attached its listener yet — those messages are gone.
    const fire = api.ui.onmessage as (m: { type: string }) => unknown;
    fire({ type: TYPE_UI_READY });
    const afterStaleReady = posted.length;

    // The visible panel mounts and announces itself.
    fire({ type: TYPE_UI_READY });

    const delivered = posted.slice(afterStaleReady).map((m) => m.type);
    expect(delivered).toContain("key");
    expect(delivered).toContain("tab");
  });

  it("re-delivers what an onUiReady callback posted, not just the queue", () => {
    // The selection descriptor is sent from a callback rather than queued directly, so
    // it would otherwise be the one boot message that could not be replayed.
    const { api, posted } = makeFigmaStub();

    beginUiSession(api);
    postToUi(api, { type: "key", payload: "k" });
    onUiReady(api, () => postToUi(api, { type: "image-selected", payload: null }));

    const fire = api.ui.onmessage as (m: { type: string }) => unknown;
    fire({ type: TYPE_UI_READY });
    const afterStaleReady = posted.length;
    fire({ type: TYPE_UI_READY });

    expect(posted.slice(afterStaleReady).map((m) => m.type)).toContain("image-selected");
  });

  it("does NOT replay messages sent after the boot burst", () => {
    // A stale ready must not resurrect a byte-read reply or a placement acknowledgement
    // from earlier in the session: both are correlated by id and belong to a request the
    // new iframe never made.
    const { api, posted } = makeFigmaStub();

    beginUiSession(api);
    postToUi(api, { type: "key", payload: "k" });
    const fire = api.ui.onmessage as (m: { type: string }) => unknown;
    fire({ type: TYPE_UI_READY });

    postToUi(api, { type: "image-bytes-result", requestId: "bytes-1" });
    const before = posted.length;

    fire({ type: TYPE_UI_READY });

    expect(posted.slice(before).map((m) => m.type)).not.toContain("image-bytes-result");
  });

  it("does not replay a previous session's burst into a new one", () => {
    // A tab switch starts a fresh session; the old tab and balance are stale by
    // definition and must not arrive in the new panel.
    const { api, posted } = makeFigmaStub();

    beginUiSession(api);
    postToUi(api, { type: "tab", payload: "Upscale" });
    const fire = api.ui.onmessage as (m: { type: string }) => unknown;
    fire({ type: TYPE_UI_READY });

    beginUiSession(api);
    const before = posted.length;
    fire({ type: TYPE_UI_READY });

    expect(posted.slice(before)).toHaveLength(0);
  });
});

