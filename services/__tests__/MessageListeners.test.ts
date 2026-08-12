import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setMessageListeners } from "../MessageListeners";
import { beginUiSession, resetUiBridge } from "../UiBridge";
import CustomSessionStorage from "../CustomSessionStorage";
import {
  NODE_CANNOT_HOLD_IMAGE_ERR,
  SOURCE_LAYER_GONE_ERR,
  TYPE_APPLY_IMAGE,
  TYPE_CLOSE_PLUGIN,
  TYPE_GET_BALANCE,
  TYPE_IMAGE_BYTES_RESULT,
  TYPE_NOTIFY,
  TYPE_PLACEMENT_DONE,
  TYPE_PLACE_EDITED_IMAGES,
  TYPE_REQUEST_IMAGE_BYTES,
  TYPE_SET_BALANCE,
} from "../../constants/index";
import { imagePaint, makeFigmaStub, makeNode, solidPaint } from "./figmaStub";

/**
 * Every message from the UI goes through one dispatcher, and it had no tests at all —
 * the largest coverage gap in the repo. Both of the money-path defects that present as
 * "I clicked the button, I got charged, nothing happened" live in here or one call
 * away, and neither needs an API key to exercise.
 */

const BYTES = new Uint8Array([7, 7, 7]);

// Drives a message through the real bridge rather than calling the handler directly,
// so the registration path and the queue are part of what is under test.
const send = async (api: PluginAPI, message: Record<string, unknown>) => {
  await (api.ui.onmessage as (m: unknown) => Promise<void>)(message);
};

const ready = (api: PluginAPI) => {
  beginUiSession(api);
  // The bridge holds everything until the UI announces itself.
  (api.ui.onmessage as (m: { type: string }) => unknown)({ type: "ui-ready" });
  setMessageListeners(api);
};

describe("handleUiMessage", () => {
  beforeEach(() => resetUiBridge());
  afterEach(() => {
    resetUiBridge();
    vi.restoreAllMocks();
  });

  describe("notifications", () => {
    it("reports a failure as an error rather than dropping it", async () => {
      // TYPE_NOTIFY sits ahead of the `response.success` gate deliberately. Behind it,
      // every error the UI tried to report was discarded in silence.
      const { api, notified } = makeFigmaStub();
      ready(api);

      await send(api, { type: TYPE_NOTIFY, success: false, msg: "it went wrong" });

      expect(notified).toEqual([{ msg: "it went wrong", error: true }]);
    });

    it("passes a success notification through without the error flag", async () => {
      const { api, notified } = makeFigmaStub();
      ready(api);

      await send(api, { type: TYPE_NOTIFY, success: true, msg: "working on it" });

      expect(notified).toEqual([{ msg: "working on it", error: false }]);
    });
  });

  describe("byte reads", () => {
    it("answers with the bytes of the node it was asked about", async () => {
      const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
      const { api, posted } = makeFigmaStub({ selection: [node], images: { h1: BYTES } });
      ready(api);

      await send(api, {
        type: TYPE_REQUEST_IMAGE_BYTES,
        nodeId: "1:2",
        requestId: "req-1",
      });

      const reply = posted.find((msg) => msg.type === TYPE_IMAGE_BYTES_RESULT);
      expect(reply).toMatchObject({ requestId: "req-1", nodeId: "1:2", bytes: BYTES });
    });

    it("says why it could not read, rather than answering a bare null", async () => {
      const node = makeNode({ id: "1:2", fills: [solidPaint()] });
      const { api, posted } = makeFigmaStub({ selection: [node] });
      ready(api);

      await send(api, {
        type: TYPE_REQUEST_IMAGE_BYTES,
        nodeId: "1:2",
        requestId: "req-2",
      });

      const reply = posted.find((msg) => msg.type === TYPE_IMAGE_BYTES_RESULT);
      expect(reply).toMatchObject({ bytes: null, reason: "no-image" });
    });

    it("always answers, even when the request is malformed", async () => {
      // A UI left waiting on a reply that never comes just spins forever.
      const { api, posted } = makeFigmaStub();
      ready(api);

      await send(api, { type: TYPE_REQUEST_IMAGE_BYTES, requestId: "req-3" });

      const reply = posted.find((msg) => msg.type === TYPE_IMAGE_BYTES_RESULT);
      expect(reply).toBeDefined();
      expect(reply).toMatchObject({ bytes: null, reason: "read-failed" });
    });
  });

  describe("placement acknowledgement", () => {
    it("acknowledges a successful apply with the id the UI sent", async () => {
      const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
      const { api, posted } = makeFigmaStub({ selection: [node] });
      ready(api);

      await send(api, {
        type: TYPE_APPLY_IMAGE,
        success: true,
        nodeId: "1:2",
        msg: BYTES,
        placementId: "place-1",
      });

      const ack = posted.find((msg) => msg.type === TYPE_PLACEMENT_DONE);
      expect(ack).toMatchObject({ placementId: "place-1", success: true });
    });

    it("acknowledges a FAILED apply, so the UI is never left waiting", async () => {
      // Without an ack on the failure path the panel keeps its loading overlay up
      // forever on exactly the runs that went wrong.
      const { api, posted, notified } = makeFigmaStub({ selection: [] });
      ready(api);

      await send(api, {
        type: TYPE_APPLY_IMAGE,
        success: true,
        nodeId: "deleted",
        msg: BYTES,
        placementId: "place-2",
      });

      const ack = posted.find((msg) => msg.type === TYPE_PLACEMENT_DONE);
      expect(ack).toMatchObject({ placementId: "place-2", success: false });
      expect(ack?.msg).toBe(SOURCE_LAYER_GONE_ERR);
      expect(notified).toEqual([{ msg: SOURCE_LAYER_GONE_ERR, error: true }]);
    });

    it("acknowledges a malformed apply instead of writing bytes to nowhere", async () => {
      const { api, posted } = makeFigmaStub();
      ready(api);

      await send(api, { type: TYPE_APPLY_IMAGE, success: true, placementId: "place-3" });

      const ack = posted.find((msg) => msg.type === TYPE_PLACEMENT_DONE);
      expect(ack).toMatchObject({ placementId: "place-3", success: false });
      expect(ack?.msg).toBe(NODE_CANNOT_HOLD_IMAGE_ERR);
    });

    it("routes edit-mode candidates to placeBesideSource and acknowledges them", async () => {
      const source = makeNode({ id: "1:src", x: 0, y: 0, width: 200, height: 200 });
      const parent = makeNode({ id: "1:frame", type: "FRAME", children: [source], layoutMode: "NONE" });
      const { api, posted } = makeFigmaStub({ selection: [source], pageNodes: [parent] });
      ready(api);

      await send(api, {
        type: TYPE_PLACE_EDITED_IMAGES,
        success: true,
        images: [BYTES],
        prompt: "make it night",
        sourceNodeId: "1:src",
        placementId: "place-4",
      });

      const ack = posted.find((msg) => msg.type === TYPE_PLACEMENT_DONE);
      expect(ack).toMatchObject({ placementId: "place-4", success: true });
      expect(parent.children?.some((child) => child.name.startsWith("Edit:"))).toBe(true);
    });
  });

  describe("the balance guard", () => {
    beforeEach(() => {
      // The cache is a module-level singleton, so each case starts from a known value.
      CustomSessionStorage.getInstance().setBalance(0);
    });

    it("accepts a real number", async () => {
      const { api, posted } = makeFigmaStub();
      ready(api);

      await send(api, { type: TYPE_SET_BALANCE, success: true, msg: "42" });

      const reply = posted.find((msg) => msg.type === TYPE_GET_BALANCE);
      expect(reply?.payload).toBe(42);
    });

    it.each(["", "undefined", "API key is wrong", "NaN"])(
      "refuses %o and echoes the last known good value back",
      async (poison) => {
        const { api, posted } = makeFigmaStub();
        ready(api);
        CustomSessionStorage.getInstance().setBalance(17);

        await send(api, { type: TYPE_SET_BALANCE, success: true, msg: poison });

        // Caching one of these poisons the balance for the whole plugin session,
        // because nothing re-fetches it — and `"..." <= 0` is false, so every button
        // stays enabled and every paid call goes ahead against a balance nobody read.
        const reply = posted.find((msg) => msg.type === TYPE_GET_BALANCE);
        expect(reply?.payload).toBe(17);
      }
    );

    it("answers a plain balance request from the cache", async () => {
      const { api, posted } = makeFigmaStub();
      ready(api);
      CustomSessionStorage.getInstance().setBalance(9);

      await send(api, { type: TYPE_GET_BALANCE, success: true });

      expect(posted.find((msg) => msg.type === TYPE_GET_BALANCE)?.payload).toBe(9);
    });
  });

  describe("everything goes through the bridge", () => {
    it("queues replies posted before the UI has announced itself", async () => {
      // Three sites in this file used to call figma.ui.postMessage directly, in the
      // very file that owns the dispatcher. A direct post before the iframe is
      // listening is simply lost, and the balance reply is exactly the class of
      // message the bridge exists to protect.
      const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
      const { api, posted } = makeFigmaStub({ selection: [node], images: { h1: BYTES } });

      beginUiSession(api);
      setMessageListeners(api);

      await send(api, {
        type: TYPE_REQUEST_IMAGE_BYTES,
        nodeId: "1:2",
        requestId: "req-queued",
      });
      expect(posted).toHaveLength(0);

      (api.ui.onmessage as (m: { type: string }) => unknown)({ type: "ui-ready" });
      expect(posted.find((msg) => msg.type === TYPE_IMAGE_BYTES_RESULT)).toBeDefined();
    });
  });

  describe("close", () => {
    it("closes the plugin on request", async () => {
      const stub = makeFigmaStub();
      ready(stub.api);

      await send(stub.api, { type: TYPE_CLOSE_PLUGIN, success: true });

      expect(stub.closed).toBe(true);
    });
  });
});
