import { sendMessageToSandBox } from "@api/index";
import {
  TYPE_APPLY_IMAGE,
  TYPE_GENERATED_IMAGES,
  TYPE_PLACE_EDITED_IMAGES,
  TYPE_PLACEMENT_DONE,
} from "@constants/index";
import type { PlacementDoneMessage } from "@app-types/messages";

/**
 * Canvas writes the UI can actually wait for.
 *
 * Only the sandbox can touch the canvas, so every placement is a postMessage — and
 * before this there was no reply. Two bugs came straight out of that:
 *
 * - **The instant-removal flow closed the plugin on a race with its own apply.**
 *   `figma.ui.onmessage` is a plain callback and Figma does not await the promise a
 *   handler returns, so the apply suspended at `await getNodeByIdAsync` and the
 *   close ran `figma.closePlugin()` before it resumed. The user was charged and the
 *   layer never changed, with no error.
 * - **The Generate panel dropped its loading state before placement had happened.**
 *   `setLoading(false)` fired immediately after posting, while the sandbox went on
 *   placing images for several seconds. There was no state a "Placing results…"
 *   message could be attached to.
 *
 * Each call below posts with a fresh `placementId` and resolves when the sandbox
 * acknowledges that id.
 */

export interface PlacementOutcome {
  ok: boolean;
  message: string;
  /** True when no acknowledgement arrived in time; the message is a guess, not news. */
  timedOut?: boolean;
}

/**
 * Long enough for ten full-resolution images plus a font load, short enough that a
 * dropped acknowledgement does not strand the panel. A timeout is reported, not
 * swallowed: the write may well have succeeded, so the copy must not claim it failed.
 */
const PLACEMENT_TIMEOUT_MS = 45000;

let nextPlacementId = 0;

const awaitAck = (placementId: string): Promise<PlacementOutcome> =>
  new Promise((resolve) => {
    let settled = false;

    const settle = (outcome: PlacementOutcome) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(outcome);
    };

    const onMessage = ({ data: { pluginMessage } }: MessageEvent) => {
      if (!pluginMessage || pluginMessage.type !== TYPE_PLACEMENT_DONE) return;
      const ack = pluginMessage as PlacementDoneMessage;
      // Correlated by id, so two placements in flight cannot resolve each other's
      // promise — the same reason the byte channel carries a requestId.
      if (ack.placementId !== placementId) return;
      settle({ ok: ack.success, message: ack.msg });
    };

    const timer = setTimeout(
      () =>
        settle({
          ok: false,
          timedOut: true,
          message: "Still placing the result. Check the canvas in a moment.",
        }),
      PLACEMENT_TIMEOUT_MS
    );

    window.addEventListener("message", onMessage);
  });

const post = (
  type: string,
  extra: Record<string, unknown>,
  msg: string | Uint8Array = "",
  scaleFactor?: number
): Promise<PlacementOutcome> => {
  const placementId = `place-${++nextPlacementId}`;
  // The listener is attached before the message goes out. The sandbox cannot reply
  // faster than this function returns, but ordering it the other way is the class of
  // bug this whole module exists to close.
  const ack = awaitAck(placementId);
  sendMessageToSandBox(true, msg, type, scaleFactor, { ...extra, placementId });
  return ack;
};

/** Write one finished result onto the node it was made from. */
export const applyImageToCanvas = (options: {
  bytes: Uint8Array;
  nodeId: string;
  scaleFactor?: number;
}): Promise<PlacementOutcome> =>
  post(
    TYPE_APPLY_IMAGE,
    { nodeId: options.nodeId },
    options.bytes,
    options.scaleFactor
  );

/** Place text-to-image results in the shared gallery frame. */
export const placeGeneratedImages = (options: {
  images: Uint8Array[];
  prompt: string;
}): Promise<PlacementOutcome> =>
  post(TYPE_GENERATED_IMAGES, { images: options.images, prompt: options.prompt });

/** Place edit-mode candidates beside the layer they were made from. */
export const placeEditedImages = (options: {
  images: Uint8Array[];
  prompt: string;
  sourceNodeId: string;
}): Promise<PlacementOutcome> =>
  post(TYPE_PLACE_EDITED_IMAGES, {
    images: options.images,
    prompt: options.prompt,
    sourceNodeId: options.sourceNodeId,
  });
