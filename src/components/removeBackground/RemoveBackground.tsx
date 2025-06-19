import React, { useState } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  TYPE_SET_BALANCE,
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
  setImageBytes: (bytes: Uint8Array) => void;
  isCreditsInsufficient: boolean;
}

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes,
  isCreditsInsufficient,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const processImage = async () => {
    if (
      !imageBytes ||
      !gottenKey ||
      !imageBytes.length ||
      isCreditsInsufficient
    )
      return;
    setLoading(true);
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    const response = await removeBackgroundApi(imageBytes, gottenKey);
    setImageBytes(response.msg as Uint8Array);
    sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
    sendMessageToSandBox(true, String(response.updatedCredits), TYPE_SET_BALANCE); 
    setLoading(false);
  };

  let btnTpe = null;
  let cb = () => {};
  if (imageBytes && imageBytes.length && gottenKey && !isCreditsInsufficient) {
    btnTpe = BtnType.REMOVE_BG_ACTIVE;
    cb = processImage;
  } else if (
    imageBytes &&
    imageBytes.length &&
    gottenKey &&
    isCreditsInsufficient
  ) {
    btnTpe = BtnType.REMOVE_BG_NO_CREDITS;
    cb = () => {
      window.open(PRICING, "_blank");
    };
  } else {
    btnTpe = BtnType.REMOVE_BG_DISABLED;
  }

  return (
    <div
      style={{
        marginBottom: "75px",
      }}
    >
      <ImageSelectionBanner
        isImageSelected={imageBytes && imageBytes.length > 0}
      />
      <Button type={btnTpe} cb={cb} tabIndex={8} />
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default RemoveBackground;
