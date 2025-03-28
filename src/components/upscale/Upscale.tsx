import React, { useState } from "react";
import Selector from "@components/selector/Selector";
import { enhanceImage, sendMessageToSandBox } from "@api/index";
import {
  PROCESSING_IMAGE,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
} from "@constants/index";
import { Button, LoadingSpinner } from "@components/index";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface UpscaleProps {
  gottenKey: string;
  imageBytes: Uint8Array;
  setImageBytes: (bytes: Uint8Array) => void;
  setUpdateBalance: (arg: (number: number) => number) => void;
  isCreditsInsufficient: boolean;
}
const options = ["2", "4", "6", "8"];

const Upscale: React.FC<UpscaleProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes,
  setUpdateBalance,
  isCreditsInsufficient,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const [scaleFactor, setScaleFactor] = useState(2);

  const handleSubmit = async () => {
    if (!imageBytes || !imageBytes.length || !isCreditsInsufficient) return;
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
    setUpdateBalance((prev) => ++prev);
  };

  const handleOnChange = (val: string) => {
    setScaleFactor(Number(val));
  };

  return (
    <div className="upscale-container">
      <div className="upscale-header">
        <span className="header-text">Choose enhance factor</span>
        <Selector onChange={handleOnChange} options={options} text="2" />
      </div>
      <Button
        type={
          imageBytes && imageBytes.length > 0 && gottenKey && isCreditsInsufficient
            ? BtnType.UPSCALE_ACTIVE
            : BtnType.UPSCALE_DISABLED
        }
        cb={handleSubmit}
      />
      <p className="upscale-text">
        Enhance Factor adjusts the level of improvement, such as image quality
        and resolution
      </p>
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default Upscale;
