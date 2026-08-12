// Payload types for the postMessage seam between the sandbox and the UI iframe.
//
// These live in a normal module, exported, rather than in global.d.ts as ambient
// declarations. Ambient types are invisible to grep-by-import: nothing shows you
// who depends on them, and an editor will happily autocomplete a name you never
// imported. `MessageEvent.data` is typed `any`, so this file is the only thing
// standing between a renamed field and a silent undefined at runtime.

/** What the sandbox knows about the current selection. Deliberately no bytes. */
export interface SelectionDescriptor {
  /** Resolved with getNodeByIdAsync at request time — never a live selection read. */
  nodeId: string;
  nodeType: string;
  name: string;
  width: number;
  height: number;
  /** False for a text or vector layer with no image paint. */
  hasImageFill: boolean;
  /**
   * How many layers are selected. The sandbox acts on `selection[0]` only, so the
   * banner has to say so when this is above 1 — otherwise "the selected image" is
   * a claim about one layer while the work happens on another.
   */
  selectionCount: number;
}

/**
 * Four states, not two. The old boolean could not tell "we have not heard from
 * the sandbox yet" from "nothing is selected", so the banner claimed nothing was
 * selected for the first 400ms of every launch, with an image selected — and it
 * could not tell "you selected a text layer" from "you selected nothing", which
 * reads as a bug to anyone who just clicked a layer.
 */
export type SelectionState =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "no-image"; descriptor: SelectionDescriptor }
  | { kind: "image"; descriptor: SelectionDescriptor };

/** Sandbox -> UI: the selection changed. `null` means nothing is selected. */
export interface ImageSelectedMessage {
  type: string;
  payload: SelectionDescriptor | null;
}

/** UI -> sandbox: read the bytes of this specific node, please. */
export interface RequestImageBytesMessage {
  type: string;
  nodeId: string;
  /** Correlates the reply, so two overlapping requests cannot be confused. */
  requestId: string;
}

/**
 * Why a byte read produced nothing.
 *
 * The channel used to collapse all three into a bare `null`, so the UI had one
 * message ("no image bytes were returned") for three different situations and no
 * way to tell the user which had happened.
 */
export type BytesFailureReason =
  /** The node id no longer resolves — deleted between press and read. */
  | "node-gone"
  /** The node resolved but carries no image paint. */
  | "no-image"
  /** The sandbox threw while reading. `error` carries the detail. */
  | "read-failed"
  /** No reply arrived at all within the request timeout. */
  | "timeout";

/** Sandbox -> UI: the answer to a RequestImageBytesMessage. */
export interface ImageBytesResultMessage {
  type: string;
  requestId: string;
  nodeId: string;
  bytes: Uint8Array | null;
  reason?: BytesFailureReason;
  error?: string;
}

/** What `requestBytes` resolves to. Never a bare null — the reason is the point. */
export type BytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: BytesFailureReason; error?: string };

/** UI -> sandbox: write this finished result onto this node. */
export interface ApplyImageMessage {
  type: string;
  success: boolean;
  msg: Uint8Array;
  /** The node captured when the request was made, not whatever is selected now. */
  nodeId: string;
  scaleFactor?: number;
  /** Correlates the TYPE_PLACEMENT_DONE acknowledgement. */
  placementId?: string;
}

/**
 * Sandbox -> UI: a canvas write finished, successfully or not.
 *
 * The UI cannot observe the canvas, so before this it had no way to know when — or
 * whether — a placement completed. Two things depended on guessing: the instant-
 * removal flow closed the plugin on a race with its own apply, and the Generate
 * panel dropped its loading state while the sandbox was still placing images.
 */
export interface PlacementDoneMessage {
  type: string;
  placementId?: string;
  success: boolean;
  msg: string;
}
