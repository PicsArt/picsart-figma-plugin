import React, { useState } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PROCESSING_IMAGE,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
} from "@constants/index";
import {
  Button,
  ImageSelectionBanner,
  LoadingSpinner,
} from "@components/index";
import { BtnType } from "../../types/enums";

interface RemoveBackgroundProps {
  gottenKey: string;
  imageBytes: Uint8Array;
  setImageBytes: (bytes: Uint8Array) => void
}

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const processImage = async () => {
    setLoading(true);
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    const response = await removeBackgroundApi(imageBytes, gottenKey);
    setImageBytes(response.msg as Uint8Array);
    sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
    setLoading(false);
  };

  return (
    <div
      style={{
        marginBottom: "75px",
      }}
    >
      <ImageSelectionBanner
        isImageSelected={imageBytes && imageBytes.length > 0}
      />
      <Button
        type={
          imageBytes && imageBytes.length > 0 && gottenKey
            ? BtnType.REMOVE_BG_ACTIVE
            : BtnType.REMOVE_BG_DISABLED
        }
        cb={processImage}
      />
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default RemoveBackground;
