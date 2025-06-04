import React, { useState } from "react";
import Selector from "@components/selector/Selector";
import { sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  TYPE_NOTIFY,
} from "@constants/index";
import { Button, LoadingSpinner } from "@components/index";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface UpscaleProps {
  gottenKey: string;
  needToSetUpdateBalance: (arg: (number: number) => number) => void;
  isCreditsInsufficient: boolean;
}
const options = ["2", "4", "6", "8"];

const GenerateImage: React.FC<UpscaleProps> = ({
  gottenKey,
  needToSetUpdateBalance,
  isCreditsInsufficient,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const [scaleFactor, setScaleFactor] = useState(2);

  const handleSubmit = async () => {
    if (!gottenKey || isCreditsInsufficient) return;
    setLoading(true);

    if (!scaleFactor) return;
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    // const response = await enhanceImage(imageBytes, gottenKey, scaleFactor);
    // sendMessageToSandBox(
    //   response.success,
    //   response.msg,
    //   TYPE_IMAGEBYTES,
    //   scaleFactor
    // );
    setLoading(false);
    needToSetUpdateBalance((prev) => ++prev);
  };

  const handleOnChange = (val: string) => {
    setScaleFactor(Number(val));
  };

  let btnTpe = null;
  let cb = () => {};
  if (gottenKey && !isCreditsInsufficient) {
    btnTpe = BtnType.UPSCALE_ACTIVE;
    cb = handleSubmit;
  } else if (gottenKey && isCreditsInsufficient) {
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
        <h1>Generate Image</h1>
        <span className="header-text">Choose enhance factor</span>
        <Selector onChange={handleOnChange} options={options} text="2" />
      </div>
      <Button type={btnTpe} cb={cb} />
      <p className="upscale-text">
        Enhance Factor adjusts the level of improvement, such as image quality
        and resolution
      </p>
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default GenerateImage;
