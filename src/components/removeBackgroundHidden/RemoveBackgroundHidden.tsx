import React, { useEffect } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PROCESSING_IMAGE,
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
      sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
      sendMessageToSandBox(response.success, "", TYPE_CLOSE_PLUGIN);
    };

    processImage();
  });

  return <></>;
};

export default RemoveBackgroundHidden;
