import React, { useState } from "react";
import Selector from "@components/Selector/Selector";
import { enhanceImage, sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  TYPE_SET_BALANCE,
} from "@constants/index";
import { Button, LoadingSpinner } from "@components/index";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface UpscaleProps {
  gottenKey: string;
  imageBytes: Uint8Array;
  setImageBytes: (bytes: Uint8Array) => void;
  isCreditsInsufficient: boolean;
}
const options = ["2", "4", "6", "8"];

const Upscale: React.FC<UpscaleProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes,
  isCreditsInsufficient,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const [scaleFactor, setScaleFactor] = useState(2);

  const handleSubmit = async () => {
    if (
      !imageBytes ||
      !gottenKey ||
      !imageBytes.length ||
      isCreditsInsufficient
    )
      return;
    setLoading(true);

    if (!scaleFactor) return;
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    const response = await enhanceImage(imageBytes, gottenKey, scaleFactor);
    setImageBytes(response.msg as Uint8Array);
    sendMessageToSandBox(
      response.success,
      response.msg,
      TYPE_IMAGEBYTES,
      scaleFactor
    );
    setLoading(false);
    sendMessageToSandBox(true, String(response.updatedCredits), TYPE_SET_BALANCE);
  };

  const handleOnChange = (val: string) => {
    setScaleFactor(Number(val));
  };

  let btnTpe = null;
  let cb = () => {};
  if (imageBytes && imageBytes.length && gottenKey && !isCreditsInsufficient) {
    btnTpe = BtnType.UPSCALE_ACTIVE;
    cb = handleSubmit;
  } else if (
    imageBytes &&
    imageBytes.length &&
    gottenKey &&
    isCreditsInsufficient
  ) {
    btnTpe = BtnType.UPSCALE_NO_CREDITS;
    cb = () => {
      window.open(PRICING, "_blank");
    };
  } else {
    btnTpe = BtnType.UPSCALE_DISABLED;
  }

  return (
    <div className="upscale-container">
      <div className="upscale-header">
        <span className="header-text">Choose enhance factor</span>
        <Selector onChange={handleOnChange} options={options} text="2" tabIndex={8} />
      </div>
      <Button type={btnTpe} cb={cb} tabIndex={9} />
      <p className="upscale-text">
        Enhance Factor adjusts the level of improvement, such as image quality
        and resolution
      </p>
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default Upscale;
