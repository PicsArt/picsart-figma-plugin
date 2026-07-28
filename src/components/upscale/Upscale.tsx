import React, { useState } from "react";
import Selector from "@components/Selector/Selector";
import { enhanceImage, sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  TYPE_SET_BALANCE,
  UPSCALE_FAILED_ERR,
  UPSCALE_FORMAT_OPTIONS,
  DEFAULT_UPSCALE_FORMAT,
  WIDGET_HEIGHT_UPSCALE_WITH_KEY,
  WIDGET_HEIGHT_UPSCALE_ADVANCED,
} from "@constants/index";
import { Button, LoadingSpinner } from "@components/index";
import usePluginHeight from "@hooks/usePluginHeight";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface UpscaleProps {
  gottenKey: string;
  imageBytes: Uint8Array;
  setImageBytes: (bytes: Uint8Array) => void;
  isCreditsInsufficient: boolean;
  isOffline: boolean;
}
const options = ["2", "4", "6", "8"];

const Upscale: React.FC<UpscaleProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes,
  isCreditsInsufficient,
  isOffline,
}) => {
  const [loading, setLoading] = useState<boolean>(false);

  const [scaleFactor, setScaleFactor] = useState(2);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [format, setFormat] = useState<string>(DEFAULT_UPSCALE_FORMAT);

  usePluginHeight(
    showAdvancedSettings ? WIDGET_HEIGHT_UPSCALE_ADVANCED : WIDGET_HEIGHT_UPSCALE_WITH_KEY
  );

  const handleSubmit = async () => {
    if (
      !imageBytes ||
      !gottenKey ||
      !imageBytes.length ||
      isCreditsInsufficient ||
      isOffline
    )
      return;
    setLoading(true);

    if (!scaleFactor) return;
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    const response = await enhanceImage(imageBytes, gottenKey, scaleFactor, format);
    if (!response.success) {
      sendMessageToSandBox(false, UPSCALE_FAILED_ERR, TYPE_NOTIFY);
      setLoading(false);
      return;
    }

    setImageBytes(response.msg as Uint8Array);
    sendMessageToSandBox(
      response.success,
      response.msg,
      TYPE_IMAGEBYTES,
      scaleFactor
    );
    setLoading(false);
    // A failed call carries no credit header, so there is no balance to report.
    if (response.updatedCredits != null) {
      sendMessageToSandBox(true, String(response.updatedCredits), TYPE_SET_BALANCE);
    }
  };

  const handleOnChange = (val: string) => {
    setScaleFactor(Number(val));
  };

  let btnTpe = null;
  let cb = () => {};
  if (isOffline) {
    // The offline banner explains why; leave cb as the no-op.
    btnTpe = BtnType.UPSCALE_DISABLED;
  } else if (imageBytes && imageBytes.length && gottenKey && !isCreditsInsufficient) {
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
      <div className="advanced-settings">
        <label
          className="settings-toggle"
          tabIndex={9}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowAdvancedSettings(!showAdvancedSettings);
            }
          }}
        >
          <input
            type="checkbox"
            checked={showAdvancedSettings}
            onChange={(e) => setShowAdvancedSettings(e.target.checked)}
            tabIndex={-1}
          />
          <span className="toggle-switch"></span>
          <span className="toggle-label">Advanced settings</span>
        </label>

        <div className={`advanced-options ${showAdvancedSettings ? "visible" : ""}`}>
          <div className="option-group">
            <label className="option-label">Format</label>
            <select
              className="option-select"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              tabIndex={showAdvancedSettings ? 10 : -1}
            >
              {UPSCALE_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Button type={btnTpe} cb={cb} tabIndex={11} />
      <p className="upscale-text">
        Enhance Factor adjusts the level of improvement, such as image quality
        and resolution
      </p>
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default Upscale;
