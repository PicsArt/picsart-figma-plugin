import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUiBridge } from "../UiBridge";
import CustomSessionStorage from "../CustomSessionStorage";
import {
  API_KEY_NAME,
  KEY_WRONG_ERR,
  TYPE_GET_BALANCE,
  TYPE_IMAGE_SELECTED,
  TYPE_KEY,
  TYPE_TAB,
} from "../../constants/index";
import { imagePaint, makeFigmaStub, makeNode } from "./figmaStub";

/**
 * The one boot sequence every controller uses, and the second of the three places that
 * write the credit balance. It had no tests, including none for the failed-balance path
 * — where one bad fetch used to cache an error string AND mark the session warm, so
 * nothing re-fetched for the rest of the session.
 */

const mocks = vi.hoisted(() => ({ getBalance: vi.fn() }));
vi.mock("@api/index", () => ({ getBalance: mocks.getBalance }));

import openPanel from "../../controllers/openPanel";

const KEY = "test-api-key";
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// The bridge holds messages until the UI announces itself, so a test that wants to
// read what was posted has to say the iframe is listening.
const announceReady = (api: PluginAPI) =>
  (api.ui.onmessage as (m: { type: string }) => unknown)({ type: "ui-ready" });

describe("openPanel", () => {
  beforeEach(() => {
    resetUiBridge();
    mocks.getBalance.mockReset();
    mocks.getBalance.mockResolvedValue({ success: true, msg: 25 });
    // A fresh singleton per case: the cache and the session flag are module state.
    CustomSessionStorage.getInstance().setBalance(0);
    (CustomSessionStorage.getInstance() as unknown as { isCurrentSession: boolean })
      .isCurrentSession = false;
  });
  afterEach(() => resetUiBridge());

  it("sends the key, the selection and the tab, in that order", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
    const { api, posted } = makeFigmaStub({
      selection: [node],
      clientStorage: { [API_KEY_NAME]: KEY },
    });

    await openPanel({ tab: "Upscale", height: 380 }, api, "<html>");
    announceReady(api);
    await flush();

    const types = posted.map((msg) => msg.type);
    expect(types).toContain(TYPE_KEY);
    expect(types).toContain(TYPE_TAB);
    expect(types).toContain(TYPE_IMAGE_SELECTED);
    expect(posted.find((msg) => msg.type === TYPE_KEY)?.payload).toBe(KEY);
    // The key must land before the tab: ui.tsx gates every panel behind `apiKey &&`,
    // so a tab that arrives first renders nothing.
    expect(types.indexOf(TYPE_KEY)).toBeLessThan(types.indexOf(TYPE_TAB));
  });

  it("queues everything until the UI reports ready, rather than guessing a delay", async () => {
    const { api, posted } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

    await openPanel({ tab: "Upscale" }, api, "<html>");
    // showUI reloads the iframe, so nothing may be posted into it yet.
    expect(posted).toHaveLength(0);

    announceReady(api);
    expect(posted.length).toBeGreaterThan(0);
  });

  it("skips the selection message when the tab does not depend on one", async () => {
    const { api, posted } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

    await openPanel({ tab: "Support", includeImageSelection: false }, api, "<html>");
    announceReady(api);
    await flush();

    expect(posted.map((msg) => msg.type)).not.toContain(TYPE_IMAGE_SELECTED);
  });

  it("caches a real balance and marks the session warm", async () => {
    const { api, posted } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

    await openPanel({ tab: "Upscale" }, api, "<html>");
    announceReady(api);
    await flush();

    expect(posted.find((msg) => msg.type === TYPE_GET_BALANCE)?.payload).toBe(25);
    expect(CustomSessionStorage.getInstance().getCurrentSession()).toBe(true);
  });

  it("does NOT cache a failed balance fetch, and does not mark the session warm", async () => {
    // The defect this pins. A failure used to be cast straight to `number` and cached,
    // and `setCurrentSession()` ran unconditionally — so the poisoned value survived
    // the whole session because nothing re-fetches, and `payload <= 0` on a string is
    // false, leaving every paid button enabled.
    mocks.getBalance.mockResolvedValue({ success: false, msg: KEY_WRONG_ERR });
    const { api, posted } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

    await openPanel({ tab: "Upscale" }, api, "<html>");
    announceReady(api);
    await flush();

    const payload = posted.find((msg) => msg.type === TYPE_GET_BALANCE)?.payload;
    expect(payload).toBe(0);
    expect(typeof payload).toBe("number");
    // Not warm, so the next panel open tries again instead of trusting the failure.
    expect(CustomSessionStorage.getInstance().getCurrentSession()).toBe(false);
  });

  it("does not fetch the balance twice in one session", async () => {
    const { api } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });

    await openPanel({ tab: "Upscale" }, api, "<html>");
    announceReady(api);
    await flush();

    resetUiBridge();
    await openPanel({ tab: "Remove BG" }, api, "<html>");
    announceReady(api);
    await flush();

    expect(mocks.getBalance).toHaveBeenCalledTimes(1);
  });

  it("does not ask for a balance when there is no key to ask with", async () => {
    const { api } = makeFigmaStub({ clientStorage: {} });

    await openPanel({ tab: "Generate Image" }, api, "<html>");
    announceReady(api);
    await flush();

    expect(mocks.getBalance).not.toHaveBeenCalled();
  });

  it("returns the key it read, which is what routing decisions are made on", async () => {
    const { api } = makeFigmaStub({ clientStorage: { [API_KEY_NAME]: KEY } });
    await expect(openPanel({ tab: "Upscale" }, api, "<html>")).resolves.toBe(KEY);
  });
});
