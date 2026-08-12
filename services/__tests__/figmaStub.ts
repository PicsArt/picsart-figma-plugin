import { vi } from "vitest";

/**
 * A PluginAPI stub covering only the members the functions under test touch.
 *
 * Deliberately not a global `figma` object. describeSelection, getBytesForNode and
 * applyImageToNode all take a PluginAPI parameter, so the injection seam that
 * already existed in this file's production code is the one used here — a global
 * stub would have needed all 21 members of the surface and would still not prove
 * the functions do not reach for the global.
 */

export interface StubNode {
  id: string;
  type: string;
  name: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  /** `"mixed"` stands in for figma.mixed on a node with per-region paints. */
  fills?: readonly unknown[] | "mixed";
  locked?: boolean;
  removed?: boolean;
  children?: StubNode[];
  parent?: StubNode | null;
  /** `"NONE"` for a plain frame; anything else makes it an auto-layout container. */
  layoutMode?: string;
  resize?: (w: number, h: number) => void;
  appendChild?: (child: StubNode) => void;
}

export const imagePaint = (imageHash: string) => ({
  type: "IMAGE",
  imageHash,
  scaleMode: "FILL",
});

export const solidPaint = () => ({
  type: "SOLID",
  color: { r: 0, g: 0, b: 0 },
});

export const makeNode = (over: Partial<StubNode> = {}): StubNode => {
  const node: StubNode = {
    id: "1:1",
    type: "RECTANGLE",
    name: "Layer",
    width: 100,
    height: 50,
    x: 0,
    y: 0,
    fills: [],
    locked: false,
    removed: false,
    parent: null,
    ...over,
  };
  if (!node.resize) {
    node.resize = vi.fn((w: number, h: number) => {
      node.width = w;
      node.height = h;
    });
  }
  if (node.children) {
    node.appendChild = (child: StubNode) => {
      (node.children as StubNode[]).push(child);
      child.parent = node;
    };
    // Parent links, so findLockedAncestor and the placement host check have a tree
    // to walk rather than a flat list.
    node.children.forEach((child) => (child.parent = node));
  }
  return node;
};

/** A container that refuses appendChild, standing in for an INSTANCE or a locked frame. */
export const makeHostileParent = (over: Partial<StubNode> = {}): StubNode => {
  const node = makeNode({ type: "FRAME", children: [], layoutMode: "NONE", ...over });
  node.appendChild = () => {
    throw new Error("cannot append to this parent");
  };
  return node;
};

/**
 * findOne walks descendants depth-first, matching Figma's own behaviour closely
 * enough for the group- and frame-resolution paths under test.
 */
const attachFindOne = (node: StubNode) => {
  if (!node.children) return;
  const walk = (n: StubNode, pred: (c: StubNode) => boolean): StubNode | null => {
    for (const child of n.children ?? []) {
      if (pred(child)) return child;
      const deeper = walk(child, pred);
      if (deeper) return deeper;
    }
    return null;
  };
  (node as unknown as { findOne: unknown }).findOne = (pred: (c: StubNode) => boolean) =>
    walk(node, pred);
  node.children.forEach(attachFindOne);
};

export interface FigmaStub {
  api: PluginAPI;
  posted: { type: string; [key: string]: unknown }[];
  notified: { msg: string; error: boolean }[];
  createdImages: Uint8Array[];
  createdRectangles: StubNode[];
  /** Nodes appended straight to the page, in order. */
  pageChildren: StubNode[];
  scrolledInto: StubNode[][];
  byId: Map<string, StubNode>;
  clientStorage: Map<string, unknown>;
  showUiCalls: unknown[];
  closed: boolean;
}

export const makeFigmaStub = (options: {
  selection?: StubNode[];
  /** Bytes keyed by imageHash. A hash absent from this map yields a null image. */
  images?: Record<string, Uint8Array>;
  /** Make createImage throw, standing in for "Image is too large" above 4096px. */
  createImageThrows?: string;
  /** Nodes on the current page that are not part of the selection. */
  pageNodes?: StubNode[];
  /** Decoded size reported for every created image. */
  imageSize?: { width: number; height: number };
  /** What figma.viewport.bounds reports. Wide enough to contain everything by default. */
  viewportBounds?: { x: number; y: number; width: number; height: number };
  clientStorage?: Record<string, unknown>;
  command?: string;
} = {}): FigmaStub => {
  const selection = options.selection ?? [];
  const extraPageNodes = options.pageNodes ?? [];
  [...selection, ...extraPageNodes].forEach(attachFindOne);

  const byId = new Map<string, StubNode>();
  const index = (n: StubNode) => {
    byId.set(n.id, n);
    (n.children ?? []).forEach(index);
  };
  [...selection, ...extraPageNodes].forEach(index);

  const posted: { type: string; [key: string]: unknown }[] = [];
  const notified: { msg: string; error: boolean }[] = [];
  const createdImages: Uint8Array[] = [];
  const createdRectangles: StubNode[] = [];
  const pageChildren: StubNode[] = [...selection, ...extraPageNodes];
  const scrolledInto: StubNode[][] = [];
  const clientStorage = new Map<string, unknown>(
    Object.entries(options.clientStorage ?? {})
  );
  const showUiCalls: unknown[] = [];
  const stub = { closed: false };

  const currentPage = {
    selection,
    children: pageChildren,
    appendChild: (child: StubNode) => {
      pageChildren.push(child);
      child.parent = null;
    },
    findOne: (pred: (n: StubNode) => boolean) => pageChildren.find(pred) ?? null,
  };

  const api = {
    command: options.command ?? "",
    currentPage,
    viewport: {
      // Large by default, so revealIfOffscreen's "already visible" branch is the one
      // taken unless a test deliberately narrows it.
      bounds: options.viewportBounds ?? { x: -10000, y: -10000, width: 20000, height: 20000 },
      center: { x: 0, y: 0 },
      scrollAndZoomIntoView: (nodes: StubNode[]) => scrolledInto.push(nodes),
    },
    ui: {
      postMessage: (msg: { type: string }) => posted.push(msg),
      resize: () => undefined,
    },
    showUI: (...args: unknown[]) => showUiCalls.push(args),
    closePlugin: () => {
      stub.closed = true;
    },
    notify: (msg: string, opts?: { error?: boolean }) =>
      notified.push({ msg, error: !!opts?.error }),
    clientStorage: {
      getAsync: async (name: string) => clientStorage.get(name),
      setAsync: async (name: string, value: unknown) => {
        clientStorage.set(name, value);
      },
    },
    getNodeByIdAsync: async (id: string) => byId.get(id) ?? null,
    getImageByHash: (hash: string) => {
      const bytes = options.images?.[hash];
      if (!bytes) return null;
      return {
        hash,
        getBytesAsync: async () => bytes,
        getSizeAsync: async () => options.imageSize ?? { width: 100, height: 50 },
      };
    },
    createImage: (bytes: Uint8Array) => {
      if (options.createImageThrows) throw new Error(options.createImageThrows);
      createdImages.push(bytes);
      return {
        hash: `hash-${createdImages.length}`,
        getSizeAsync: async () => options.imageSize ?? { width: 100, height: 50 },
      };
    },
    createRectangle: () => {
      const node = makeNode({ id: `new:${createdRectangles.length + 1}`, name: "Rectangle" });
      createdRectangles.push(node);
      return node;
    },
    loadFontAsync: async () => undefined,
  } as unknown as PluginAPI;

  return {
    api,
    posted,
    notified,
    createdImages,
    createdRectangles,
    pageChildren,
    scrolledInto,
    byId,
    clientStorage,
    showUiCalls,
    get closed() {
      return stub.closed;
    },
  };
};
