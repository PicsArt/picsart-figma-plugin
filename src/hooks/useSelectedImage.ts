import { useCallback } from "react";
import { NO_IMAGE_IN_NODE_ERR, SOURCE_LAYER_GONE_ERR } from "@constants/index";
import { SELECTION_NO_IMAGE } from "@ui_constants/index";
import { useSelection } from "../context/SelectionContext";
import type {
  BytesFailureReason,
  SelectionDescriptor,
  SelectionState,
} from "@app-types/messages";

export interface PickedImage {
  /** Captured when the button was pressed, so the result lands where it came from. */
  nodeId: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * What `takeImage` produced.
 *
 * A discriminated result rather than `PickedImage | null`, because the four ways a
 * read can come back empty are four different sentences for the user, and callers
 * used to show one generic message for all of them.
 */
export type PickResult =
  | ({ ok: true } & PickedImage)
  | { ok: false; reason: BytesFailureReason };

/** The user-facing sentence for a failed read. */
export const describeBytesFailure = (result: { reason: BytesFailureReason }): string => {
  switch (result.reason) {
    case "node-gone":
      return SOURCE_LAYER_GONE_ERR;
    case "no-image":
      return SELECTION_NO_IMAGE;
    case "timeout":
    case "read-failed":
    default:
      return NO_IMAGE_IN_NODE_ERR;
  }
};

interface UseSelectedImage {
  selection: SelectionState;
  /** True only in the "image" state — never during "unknown". */
  hasImage: boolean;
  /** True until the sandbox has reported once. Buttons stay disabled, banner stays neutral. */
  isUnknown: boolean;
  descriptor: SelectionDescriptor | null;
  /**
   * Read the bytes of the currently selected image, capturing its nodeId at this
   * moment. On failure it says which failure, so the caller can name it.
   */
  takeImage: () => Promise<PickResult>;
}

/**
 * The single selection check. There used to be three, each deriving "is an image
 * selected" from the byte length of a shared Uint8Array, and each disagreeing
 * with the sandbox about which node types count.
 */
const useSelectedImage = (): UseSelectedImage => {
  const { selection, requestBytes } = useSelection();

  const descriptor =
    selection.kind === "image" || selection.kind === "no-image"
      ? selection.descriptor
      : null;

  const takeImage = useCallback(async (): Promise<PickResult> => {
    if (selection.kind !== "image") {
      return { ok: false, reason: selection.kind === "none" ? "node-gone" : "no-image" };
    }
    const { nodeId, width, height } = selection.descriptor;
    const read = await requestBytes(nodeId);
    if (!read.ok) return read;
    return { ok: true, nodeId, bytes: read.bytes, width, height };
  }, [selection, requestBytes]);

  return {
    selection,
    hasImage: selection.kind === "image",
    isUnknown: selection.kind === "unknown",
    descriptor,
    takeImage,
  };
};

export default useSelectedImage;
