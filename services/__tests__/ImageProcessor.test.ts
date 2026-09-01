import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyImageToNode,
  describeSelection,
  getBytesForNode,
  sendImageSelectionStatus,
} from "../ImageProcessor";
import { beginUiSession, resetUiBridge } from "../UiBridge";
import {
  NODE_CANNOT_HOLD_IMAGE_ERR,
  SOURCE_LAYER_GONE_ERR,
  SOURCE_LAYER_LOCKED_ERR,
  UPSCALE_SUCC_COMPLETED,
  BACKGROUND_SUCC_REMOVED,
  TYPE_IMAGE_SELECTED,
  TYPE_UI_READY,
} from "../../constants/index";
import { imagePaint, makeFigmaStub, makeNode, solidPaint } from "./figmaStub";

const BYTES = new Uint8Array([9, 8, 7]);

describe("describeSelection", () => {
  it("returns null when nothing is selected", () => {
    const { api } = makeFigmaStub({ selection: [] });
    expect(describeSelection(api)).toBeNull();
  });

  it("reports an image-filled rectangle as usable", () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], width: 800.4, height: 600.6 });
    const { api } = makeFigmaStub({ selection: [node] });

    expect(describeSelection(api)).toEqual({
      nodeId: "1:2",
      nodeType: "RECTANGLE",
      name: "Layer",
      // Rounded, because Figma dimensions are floats and these end up in copy.
      width: 800,
      height: 601,
      hasImageFill: true,
      selectionCount: 1,
    });
  });

  it("reports a layer with no image fill as selected but unusable", () => {
    const node = makeNode({ type: "TEXT", fills: [solidPaint()] });
    const { api } = makeFigmaStub({ selection: [node] });

    const result = describeSelection(api);
    expect(result?.hasImageFill).toBe(false);
    // Still described, so the banner can say "that layer has no image in it"
    // rather than "nothing is selected".
    expect(result?.nodeType).toBe("TEXT");
  });

  it("resolves a GROUP to the image-bearing child, since a group has no fills", () => {
    const child = makeNode({ id: "1:child", fills: [imagePaint("h1")] });
    const group = makeNode({ id: "1:group", type: "GROUP", fills: undefined, children: [child] });
    const { api } = makeFigmaStub({ selection: [group] });

    const result = describeSelection(api);
    expect(result?.hasImageFill).toBe(true);
    // The id is the child's: writing the result to the group would silently do
    // nothing, because GroupNode has resize but not fills.
    expect(result?.nodeId).toBe("1:child");
    // The reported type stays the group, which is what the user actually clicked.
    expect(result?.nodeType).toBe("GROUP");
  });

  it("accepts a FRAME holding an image child", () => {
    const child = makeNode({ id: "1:img", fills: [imagePaint("h1")] });
    const frame = makeNode({ id: "1:frame", type: "FRAME", fills: [], children: [child] });
    const { api } = makeFigmaStub({ selection: [frame] });

    const result = describeSelection(api);
    // A framed photo is the most common way an image sits in a real file, and it
    // used to fall through to "nothing selected".
    expect(result?.hasImageFill).toBe(true);
    expect(result?.nodeId).toBe("1:img");
  });

  it("prefers the node's own image fill over a descendant's", () => {
    const child = makeNode({ id: "1:child", fills: [imagePaint("child-hash")] });
    const frame = makeNode({
      id: "1:frame",
      type: "FRAME",
      fills: [imagePaint("own-hash")],
      children: [child],
    });
    const { api } = makeFigmaStub({ selection: [frame] });

    expect(describeSelection(api)?.nodeId).toBe("1:frame");
  });

  it("survives figma.mixed fills without throwing", () => {
    // Reading mixed fills as an array yields a symbol, and calling .find on it
    // throws. The old code cast straight to ReadonlyArray<Paint>.
    const node = makeNode({ fills: "mixed" });
    const { api } = makeFigmaStub({ selection: [node] });

    expect(() => describeSelection(api)).not.toThrow();
    expect(describeSelection(api)?.hasImageFill).toBe(false);
  });

  it("reports how many layers are selected so the copy can be honest", () => {
    const a = makeNode({ id: "1:a", fills: [imagePaint("h1")], name: "First" });
    const b = makeNode({ id: "1:b", fills: [imagePaint("h2")], name: "Second" });
    const { api } = makeFigmaStub({ selection: [a, b] });

    const result = describeSelection(api);
    // selection[0] wins, and the count is what lets the banner admit it.
    expect(result?.name).toBe("First");
    expect(result?.selectionCount).toBe(2);
  });

  it("carries no image bytes at all", () => {
    const node = makeNode({ fills: [imagePaint("h1")] });
    const { api } = makeFigmaStub({ selection: [node], images: { h1: BYTES } });

    // The whole point of the descriptor: selectionchange fires on every click, and
    // it used to serialize the full decoded image across postMessage each time.
    expect(JSON.stringify(describeSelection(api))).not.toContain("9");
  });
});

describe("sendImageSelectionStatus", () => {
  beforeEach(() => resetUiBridge());
  afterEach(() => resetUiBridge());

  it("posts the descriptor on the selection channel once the UI is listening", () => {
    const node = makeNode({ fills: [imagePaint("h1")] });
    const { api, posted } = makeFigmaStub({ selection: [node] });

    beginUiSession(api);
    (api.ui.onmessage as (m: { type: string }) => unknown)({ type: TYPE_UI_READY });

    sendImageSelectionStatus(api);

    expect(posted).toHaveLength(1);
    expect(posted[0].type).toBe(TYPE_IMAGE_SELECTED);
  });

  it("queues rather than drops a selectionchange that fires before the UI mounts", () => {
    // figma.on("selectionchange") is live from launch, well before the iframe has
    // rendered. A direct ui.postMessage in that window goes nowhere.
    const node = makeNode({ fills: [imagePaint("h1")] });
    const { api, posted } = makeFigmaStub({ selection: [node] });

    beginUiSession(api);
    sendImageSelectionStatus(api);
    expect(posted).toHaveLength(0);

    (api.ui.onmessage as (m: { type: string }) => unknown)({ type: TYPE_UI_READY });
    expect(posted).toHaveLength(1);
    expect(posted[0].type).toBe(TYPE_IMAGE_SELECTED);
  });
});

describe("getBytesForNode", () => {
  it("reads bytes for the node named by id", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
    const { api } = makeFigmaStub({ selection: [node], images: { h1: BYTES } });

    await expect(getBytesForNode(api, "1:2")).resolves.toEqual({ ok: true, bytes: BYTES });
  });

  it("says the node is gone rather than just failing", async () => {
    // These two used to be the same bare null, so every caller showed one generic
    // message for two situations the user can do different things about.
    const { api } = makeFigmaStub({ selection: [] });
    await expect(getBytesForNode(api, "gone")).resolves.toEqual({
      ok: false,
      reason: "node-gone",
    });
  });

  it("says the node holds no image, distinctly from being gone", async () => {
    const node = makeNode({ id: "1:2", fills: [solidPaint()] });
    const { api } = makeFigmaStub({ selection: [node] });

    await expect(getBytesForNode(api, "1:2")).resolves.toEqual({
      ok: false,
      reason: "no-image",
    });
  });

  it("treats a zero-length fill as no image rather than as empty bytes", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
    const { api } = makeFigmaStub({ selection: [node], images: { h1: new Uint8Array() } });

    await expect(getBytesForNode(api, "1:2")).resolves.toEqual({
      ok: false,
      reason: "no-image",
    });
  });
});

describe("applyImageToNode", () => {
  it("writes the result to the node it was told to, not to the live selection", async () => {
    const target = makeNode({ id: "1:target", fills: [imagePaint("h1")] });
    const distraction = makeNode({ id: "1:other", fills: [imagePaint("h2")] });
    // The user clicked away during the 10-60s call; `other` is selected now.
    const { api } = makeFigmaStub({ selection: [distraction, target] });

    const result = await applyImageToNode(api, "1:target", BYTES);

    expect(result).toEqual({ ok: true, message: BACKGROUND_SUCC_REMOVED });
    expect(target.fills).toEqual([
      { type: "IMAGE", imageHash: "hash-1", scaleMode: "FILL" },
    ]);
    // Untouched, which is the entire point of capturing the id at request time.
    expect(distraction.fills).toEqual([imagePaint("h2")]);
  });

  it("says the layer is gone rather than silently dropping a paid result", async () => {
    const { api } = makeFigmaStub({ selection: [] });
    await expect(applyImageToNode(api, "deleted", BYTES)).resolves.toEqual({
      ok: false,
      message: SOURCE_LAYER_GONE_ERR,
    });
  });

  it("names a locked layer instead of failing opaquely", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], locked: true });
    const { api } = makeFigmaStub({ selection: [node] });

    await expect(applyImageToNode(api, "1:2", BYTES)).resolves.toEqual({
      ok: false,
      message: SOURCE_LAYER_LOCKED_ERR,
    });
  });

  it("scales the node when given an upscale factor", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], width: 100, height: 50 });
    const { api } = makeFigmaStub({ selection: [node] });

    const result = await applyImageToNode(api, "1:2", BYTES, 4);

    expect(result).toEqual({ ok: true, message: UPSCALE_SUCC_COMPLETED });
    expect(node.width).toBe(400);
    expect(node.height).toBe(200);
  });

  it("does not resize for a scale factor of 1", async () => {
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], width: 100, height: 50 });
    const { api } = makeFigmaStub({ selection: [node] });

    await applyImageToNode(api, "1:2", BYTES, 1);
    expect(node.width).toBe(100);
  });

  it("reports a createImage failure instead of swallowing it", async () => {
    // figma.createImage throws "Image is too large" above 4096px in either
    // dimension. The old code let that reach an outer catch that logged and
    // continued, so the user was told the work succeeded.
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")] });
    const { api } = makeFigmaStub({
      selection: [node],
      createImageThrows: "Image is too large",
    });

    const result = await applyImageToNode(api, "1:2", BYTES);
    expect(result.ok).toBe(false);
    expect(result.message).toContain(NODE_CANNOT_HOLD_IMAGE_ERR);
    expect(result.message).toContain("Image is too large");
  });

  it("leaves the node its original size when createImage refuses the result", async () => {
    // The order matters and this is the assertion that pins it. resize used to run
    // BEFORE createImage, so a result over Figma's 4096 ceiling — which an 8x upscale
    // reaches easily — left the layer permanently scaled 2-8x with the OLD image
    // still in it. A failed paid call that corrupted the canvas.
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], width: 100, height: 50 });
    const { api } = makeFigmaStub({
      selection: [node],
      createImageThrows: "Image is too large",
    });

    const result = await applyImageToNode(api, "1:2", BYTES, 8);

    expect(result.ok).toBe(false);
    expect(node.width).toBe(100);
    expect(node.height).toBe(50);
    expect(node.fills).toEqual([imagePaint("h1")]);
  });

  it("restores the original size when the resize itself throws", async () => {
    // resize throws inside an auto-layout or otherwise constrained parent. Nothing
    // half-applied should survive that.
    const node = makeNode({ id: "1:2", fills: [imagePaint("h1")], width: 100, height: 50 });
    let calls = 0;
    node.resize = (w: number, h: number) => {
      calls++;
      // The first call is the upscale and throws; the second is the restore.
      if (calls === 1) throw new Error("cannot resize inside auto-layout");
      node.width = w;
      node.height = h;
    };
    const { api } = makeFigmaStub({ selection: [node] });

    const result = await applyImageToNode(api, "1:2", BYTES, 4);

    expect(result.ok).toBe(false);
    expect(node.width).toBe(100);
    expect(node.height).toBe(50);
  });

  it("writes through a GROUP to the child that can actually hold the fill", async () => {
    const child = makeNode({ id: "1:child", fills: [imagePaint("h1")] });
    const group = makeNode({ id: "1:group", type: "GROUP", fills: undefined, children: [child] });
    const { api } = makeFigmaStub({ selection: [group] });

    const result = await applyImageToNode(api, "1:group", BYTES);

    expect(result).toEqual({ ok: true, message: BACKGROUND_SUCC_REMOVED });
    expect(child.fills).toEqual([
      { type: "IMAGE", imageHash: "hash-1", scaleMode: "FILL" },
    ]);
  });
});
