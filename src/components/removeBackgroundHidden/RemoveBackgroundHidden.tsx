import React, { useEffect, useRef } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PROCESSING_IMAGE,
  REMOVE_BG_FAILED_ERR,
  TYPE_CLOSE_PLUGIN,
  TYPE_NOTIFY,
} from "@constants/index";
import useSelectedImage, { describeBytesFailure } from "@hooks/useSelectedImage";
import { applyImageToCanvas } from "@utils/placement";

interface RemoveBackgroundProps {
  gottenKey: string;
}

/**
 * The "Remove Background Instantly" menu command: no panel, one paid call, close.
 *
 * Because nothing is rendered, there is no spinner, no button state and no way for
 * a user to see how many times this ran. That makes the single-run guarantee below
 * the whole correctness story of this component.
 */
const RemoveBackgroundHidden: React.FC<RemoveBackgroundProps> = ({ gottenKey }) => {
  const { selection, takeImage } = useSelectedImage();

  // removeBackgroundApi is billable, so a second invocation is a silent double
  // charge. Two guards, because one is not enough: the dependency array stops
  // re-renders from re-firing, and the ref stops a fresh selection message
  // carrying the same layer from doing the same. The flow closes the plugin when
  // it finishes, so one run is all there is to guard.
  const hasRun = useRef(false);

  useEffect(() => {
    const processImage = async () => {
      // Waits for the sandbox's first selection report rather than treating the
      // startup gap as "nothing selected".
      if (selection.kind === "unknown" || !gottenKey) return;
      if (hasRun.current) return;
      hasRun.current = true;

      const picked = await takeImage();
      if (!picked.ok) {
        sendMessageToSandBox(false, describeBytesFailure(picked), TYPE_NOTIFY);
        sendMessageToSandBox(true, "", TYPE_CLOSE_PLUGIN);
        return;
      }

      sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);
      const response = await removeBackgroundApi(picked.bytes, gottenKey);
      if (!response.success) {
        // This flow closes the plugin straight after, so the notification is the
        // only thing the user ever sees. A generic string here left them with no
        // idea why nothing happened to their layer.
        sendMessageToSandBox(false, response.msg || REMOVE_BG_FAILED_ERR, TYPE_NOTIFY);
      } else {
        // AWAITED, and that is the whole fix for this component.
        //
        // These two messages used to go out back to back with nothing between them.
        // `figma.ui.onmessage` is a plain callback and Figma does not await what a
        // handler returns, so the apply suspended at `await getNodeByIdAsync` and
        // the close below ran `figma.closePlugin()` before it resumed — terminating
        // the plugin mid-write. "Remove Background Instantly" charged the user and
        // left the layer exactly as it was, with no error of any kind. It was safe
        // on main only by accident, because the old apply path had no suspension
        // point in it.
        await applyImageToCanvas({ bytes: response.msg, nodeId: picked.nodeId });
      }
      // This flow has no visible UI, so it must close either way or the plugin
      // hangs with an invisible iframe.
      sendMessageToSandBox(true, "", TYPE_CLOSE_PLUGIN);
    };

    processImage();
  }, [selection, gottenKey, takeImage]);

  return <></>;
};

export default RemoveBackgroundHidden;
