import { describe, expect, it } from "vitest";
import { placeBesideSource } from "../ImageProcessor";
import { EDIT_NOTHING_PLACED_ERR, SOURCE_LAYER_GONE_PLACED_ERR } from "../../constants/index";
import { imagePaint, makeFigmaStub, makeHostileParent, makeNode } from "./figmaStub";

const IMAGE = () => new Uint8Array([1, 2, 3]);
const GAP = 24;

const makeSourceInFrame = (over: Record<string, unknown> = {}) => {
  const source = makeNode({
    id: "1:src",
    name: "Photo",
    x: 100,
    y: 200,
    width: 400,
    height: 300,
    fills: [imagePaint("h1")],
    ...over,
  });
  const parent = makeNode({ id: "1:frame", type: "FRAME", children: [source], layoutMode: "NONE" });
  return { source, parent };
};

describe("placeBesideSource", () => {
  it("places one candidate to the right of the source, at the source's y", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    const result = await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "make the sky stormy",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(true);
    const placed = parent.children?.find((child) => child.id !== source.id);
    expect(placed).toBeDefined();
    expect(placed?.x).toBe(source.x! + source.width + GAP);
    expect(placed?.y).toBe(source.y);
  });

  it("does not touch the source layer", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "make the sky stormy",
      sourceNodeId: "1:src",
    });

    // Non-destructive by decision: the endpoint returns candidates, and overwriting
    // the source would throw away work the user paid for.
    expect(source.fills).toEqual([imagePaint("h1")]);
    expect(source.width).toBe(400);
    expect(source.x).toBe(100);
  });

  it("lays several candidates out left to right in the order they arrived", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({
      selection: [source],
      pageNodes: [parent],
      imageSize: { width: 100, height: 100 },
    });

    await placeBesideSource(api, {
      images: [IMAGE(), IMAGE(), IMAGE()],
      prompt: "stormy",
      sourceNodeId: "1:src",
    });

    const placed = (parent.children ?? []).filter((child) => child.id !== source.id);
    expect(placed).toHaveLength(3);
    expect(placed[0].x).toBeLessThan(placed[1].x!);
    expect(placed[1].x).toBeLessThan(placed[2].x!);
    // Square candidates against a 400x300 source: height matches the source, so the
    // width follows at 300 too.
    expect(placed[0].width).toBe(300);
    expect(placed[0].height).toBe(300);
    expect(placed[1].x).toBe(placed[0].x! + placed[0].width + GAP);
  });

  it("matches the source height and keeps the candidate's aspect ratio", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({
      selection: [source],
      pageNodes: [parent],
      // 2:1 result against a 300-tall source.
      imageSize: { width: 2048, height: 1024 },
    });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "wide",
      sourceNodeId: "1:src",
    });

    const placed = (parent.children ?? []).find((child) => child.id !== source.id);
    expect(placed?.height).toBe(300);
    expect(placed?.width).toBe(600);
  });

  it("starts past anything already occupying the source's row", async () => {
    // The second-run rule. Without it a second press lands on top of the first run's
    // output, and the user is left with overlapping paid results.
    const { source, parent } = makeSourceInFrame();
    const earlier = makeNode({ id: "1:earlier", x: 600, y: 200, width: 200, height: 300 });
    parent.appendChild?.(earlier);
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "second run",
      sourceNodeId: "1:src",
    });

    const placed = (parent.children ?? []).find(
      (child) => child.id !== source.id && child.id !== earlier.id
    );
    // Past the earlier node's right edge (800), not past the source's (500).
    expect(placed?.x).toBe(800 + GAP);
  });

  it("ignores siblings that do not overlap the source's vertical band", async () => {
    const { source, parent } = makeSourceInFrame();
    // Far below the source's 200..500 band, so it must not push the placement right.
    const unrelated = makeNode({ id: "1:below", x: 9000, y: 5000, width: 200, height: 200 });
    parent.appendChild?.(unrelated);
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    const placed = (parent.children ?? []).find(
      (child) => child.id !== source.id && child.id !== unrelated.id
    );
    expect(placed?.x).toBe(source.x! + source.width + GAP);
  });

  it("names candidates from the prompt, numbered when there are several", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE(), IMAGE()],
      prompt: "change the background to a beach at sunset",
      sourceNodeId: "1:src",
    });

    const names = (parent.children ?? [])
      .filter((child) => child.id !== source.id)
      .map((child) => child.name);
    expect(names[0]).toContain("Edit: change the background to a beach at sun");
    expect(names[0]).toContain("(1)");
    expect(names[1]).toContain("(2)");
  });

  it("names a single candidate without a number", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "make it night",
      sourceNodeId: "1:src",
    });

    const placed = (parent.children ?? []).find((child) => child.id !== source.id);
    expect(placed?.name).toBe("Edit: make it night");
  });

  it("selects what it placed, so the next press does not re-edit the original", async () => {
    // The duplicate-charge trap this closes: with the source still selected, the
    // banner still says "Editing this layer" and a second press charges again for the
    // same operation on the same input.
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE(), IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(api.currentPage.selection).toHaveLength(2);
    expect(api.currentPage.selection.map((node) => node.id)).not.toContain("1:src");
  });

  it("falls back to the page when the parent is an auto-layout frame", async () => {
    // An auto-layout parent owns its children's x/y, so "beside the source" cannot be
    // expressed inside one — the candidate would join the flow and shove the design.
    const source = makeNode({ id: "1:src", x: 0, y: 0, width: 100, height: 100 });
    const parent = makeNode({
      id: "1:auto",
      type: "FRAME",
      children: [source],
      layoutMode: "VERTICAL",
    });
    const { api, pageChildren } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    const result = await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("added to the page");
    // Went to the page, not into the auto-layout frame.
    expect(parent.children).toHaveLength(1);
    expect(pageChildren.some((node) => node.name.startsWith("Edit:"))).toBe(true);
  });

  it("falls back to the page when the parent is an INSTANCE", async () => {
    const source = makeNode({ id: "1:src", x: 0, y: 0, width: 100, height: 100 });
    const parent = makeNode({ id: "1:inst", type: "INSTANCE", children: [source] });
    const { api, pageChildren } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    const result = await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(true);
    expect(pageChildren.some((node) => node.name.startsWith("Edit:"))).toBe(true);
  });

  it("falls back to the page when the parent is locked", async () => {
    const source = makeNode({ id: "1:src", x: 0, y: 0, width: 100, height: 100 });
    const parent = makeHostileParent({ id: "1:locked", locked: true, children: [source] });
    source.parent = parent;
    const { api, pageChildren } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    const result = await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(true);
    expect(pageChildren.some((node) => node.name.startsWith("Edit:"))).toBe(true);
  });

  it("places at the viewport centre when the source layer is gone", async () => {
    // The result is paid for by the time this can happen. The rescue registry promised
    // a defined fallback and the copy spec said the result was discarded; the registry
    // was right.
    const { api, pageChildren } = makeFigmaStub({ selection: [] });

    const result = await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "gone",
    });

    expect(result.message).toBe(SOURCE_LAYER_GONE_PLACED_ERR);
    expect(pageChildren.some((node) => node.name.startsWith("Edit:"))).toBe(true);
  });

  it("reports a partial placement rather than a clean success", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({
      selection: [source],
      pageNodes: [parent],
      createImageThrows: "Image is too large",
    });

    const result = await placeBesideSource(api, {
      images: [IMAGE(), IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain(EDIT_NOTHING_PLACED_ERR);
  });

  it("refuses an empty batch instead of reporting success for nothing", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    const result = await placeBesideSource(api, {
      images: [],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(result.ok).toBe(false);
  });

  it("leaves the viewport alone when the results are already on screen", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api, scrolledInto } = makeFigmaStub({ selection: [source], pageNodes: [parent] });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    // scrollAndZoomIntoView re-zooms the user's canvas. Doing it when the result
    // landed beside the layer they were already looking at is hostile.
    expect(scrolledInto).toHaveLength(0);
  });

  it("scrolls when a result falls outside the viewport", async () => {
    const { source, parent } = makeSourceInFrame();
    const { api, scrolledInto } = makeFigmaStub({
      selection: [source],
      pageNodes: [parent],
      viewportBounds: { x: 0, y: 0, width: 450, height: 450 },
    });

    await placeBesideSource(api, {
      images: [IMAGE()],
      prompt: "x",
      sourceNodeId: "1:src",
    });

    expect(scrolledInto).toHaveLength(1);
  });
});
