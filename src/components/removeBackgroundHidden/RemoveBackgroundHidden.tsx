import React, { useEffect } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PROCESSING_IMAGE,
  REMOVE_BG_FAILED_ERR,
  TYPE_CLOSE_PLUGIN,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
} from "@constants/index";

interface RemoveBackgroundProps {
  gottenKey: string;
  imageBytes: Uint8Array;
}

const RemoveBackgroundHidden: React.FC<RemoveBackgroundProps> = ({
  gottenKey,
  imageBytes,
}) => {
  useEffect(() => {
    const processImage = async () => {
      if (!imageBytes || !gottenKey || !imageBytes.length) return;
      sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);
      const response = await removeBackgroundApi(imageBytes, gottenKey);
      if (!response.success) {
        sendMessageToSandBox(false, REMOVE_BG_FAILED_ERR, TYPE_NOTIFY);
      } else {
        sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
      }
      // This flow has no visible UI, so it must close either way or the plugin
      // hangs with an invisible iframe.
      sendMessageToSandBox(true, "", TYPE_CLOSE_PLUGIN);
    };

    processImage();
  });

  return <></>;
};

export default RemoveBackgroundHidden;
