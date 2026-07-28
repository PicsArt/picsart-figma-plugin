import React, { useState } from "react";
import { removeBackgroundApi, sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  REMOVE_BG_FAILED_ERR,
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  TYPE_SET_BALANCE,
  SelectOption,
  REMOVEBG_MODEL_OPTIONS,
  DEFAULT_REMOVEBG_MODEL,
  REMOVEBG_OUTPUT_TYPE_OPTIONS,
  DEFAULT_REMOVEBG_OUTPUT_TYPE,
  REMOVEBG_FORMAT_OPTIONS,
  DEFAULT_REMOVEBG_FORMAT,
  REMOVEBG_SCALE_OPTIONS,
  DEFAULT_REMOVEBG_SCALE,
  REMOVEBG_SHADOW_OPTIONS,
  DEFAULT_REMOVEBG_SHADOW,
  REMOVEBG_SHADOW_DISABLED,
  REMOVEBG_SHADOW_CUSTOM,
  REMOVEBG_OUTPUT_TYPE_CUTOUT,
  DEFAULT_REMOVEBG_BG_BLUR,
  DEFAULT_REMOVEBG_STROKE_SIZE,
  DEFAULT_REMOVEBG_STROKE_COLOR,
  DEFAULT_REMOVEBG_STROKE_OPACITY,
  DEFAULT_REMOVEBG_SHADOW_OPACITY,
  DEFAULT_REMOVEBG_SHADOW_BLUR,
  DEFAULT_REMOVEBG_SHADOW_OFFSET,
  REMOVEBG_PERCENT_MIN,
  REMOVEBG_PERCENT_MAX,
  REMOVEBG_OFFSET_MIN,
  REMOVEBG_OFFSET_MAX,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_REMOVE_BG_ADVANCED,
} from "@constants/index";
import {
  Button,
  ImageSelectionBanner,
  LoadingSpinner,
} from "@components/index";
import usePluginHeight from "@hooks/usePluginHeight";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface RemoveBackgroundProps {
  gottenKey: string;
  imageBytes: Uint8Array;
  setImageBytes: (bytes: Uint8Array) => void;
  isCreditsInsufficient: boolean;
  isOffline: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly (SelectOption | string)[];
  tabIndex: number;
  wide?: boolean;
  onChange: (value: string) => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  tabIndex: number;
  wide?: boolean;
  onChange: (value: number) => void;
}

// A plain string list is its own label; SelectOption lists label a value the
// API expects but no user would recognise (an AIR model URN, "bottom-right").
const toOption = (option: SelectOption | string): SelectOption =>
  typeof option === "string" ? { label: option, value: option } : option;

// The browser does not enforce min/max on a typed-in number, and clearing the
// field yields "", so every value is pinned to the API's accepted range here.
const clamp = (value: string, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
};

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  tabIndex,
  wide,
  onChange,
}) => (
  <div className={`option-group ${wide ? "wide" : ""}`}>
    <label className="option-label">{label}</label>
    <select
      className="option-select"
      value={value}
      tabIndex={tabIndex}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(toOption).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  min,
  max,
  tabIndex,
  wide,
  onChange,
}) => (
  <div className={`option-group ${wide ? "wide" : ""}`}>
    <label className="option-label">{label}</label>
    <input
      className="option-input"
      type="number"
      min={min}
      max={max}
      value={value}
      tabIndex={tabIndex}
      onChange={(e) => onChange(clamp(e.target.value, min, max))}
    />
  </div>
);

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({
  gottenKey,
  imageBytes,
  setImageBytes,
  isCreditsInsufficient,
  isOffline,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);

  const [model, setModel] = useState<string>(DEFAULT_REMOVEBG_MODEL);
  const [outputType, setOutputType] = useState<string>(DEFAULT_REMOVEBG_OUTPUT_TYPE);
  const [format, setFormat] = useState<string>(DEFAULT_REMOVEBG_FORMAT);
  const [scale, setScale] = useState<string>(DEFAULT_REMOVEBG_SCALE);
  const [autoCenter, setAutoCenter] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>("");
  const [bgBlur, setBgBlur] = useState<number>(DEFAULT_REMOVEBG_BG_BLUR);
  const [strokeSize, setStrokeSize] = useState<number>(DEFAULT_REMOVEBG_STROKE_SIZE);
  const [strokeColor, setStrokeColor] = useState<string>(DEFAULT_REMOVEBG_STROKE_COLOR);
  const [strokeOpacity, setStrokeOpacity] = useState<number>(DEFAULT_REMOVEBG_STROKE_OPACITY);
  const [shadow, setShadow] = useState<string>(DEFAULT_REMOVEBG_SHADOW);
  const [shadowOpacity, setShadowOpacity] = useState<number>(DEFAULT_REMOVEBG_SHADOW_OPACITY);
  const [shadowBlur, setShadowBlur] = useState<number>(DEFAULT_REMOVEBG_SHADOW_BLUR);
  const [shadowOffsetX, setShadowOffsetX] = useState<number>(DEFAULT_REMOVEBG_SHADOW_OFFSET);
  const [shadowOffsetY, setShadowOffsetY] = useState<number>(DEFAULT_REMOVEBG_SHADOW_OFFSET);

  // A mask is a black-and-white matte: background, stroke and shadow options
  // have nothing to apply to, so they are neither shown nor sent.
  const isCutout = outputType === REMOVEBG_OUTPUT_TYPE_CUTOUT;

  usePluginHeight(
    showAdvancedSettings ? WIDGET_HEIGHT_REMOVE_BG_ADVANCED : WIDGET_HEIGHT_WITH_KEY
  );

  const processImage = async () => {
    if (
      !imageBytes ||
      !gottenKey ||
      !imageBytes.length ||
      isCreditsInsufficient ||
      isOffline
    )
      return;
    setLoading(true);
    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    const response = await removeBackgroundApi(imageBytes, gottenKey, {
      model,
      output_type: outputType,
      format,
      scale: isCutout ? scale : undefined,
      auto_center: isCutout && autoCenter,
      bg_color: isCutout ? bgColor.trim() || undefined : undefined,
      bg_blur: isCutout ? bgBlur : undefined,
      stroke_size: isCutout ? strokeSize : undefined,
      stroke_color: strokeColor,
      stroke_opacity: strokeOpacity,
      shadow: isCutout ? shadow : undefined,
      shadow_opacity: shadowOpacity,
      shadow_blur: shadowBlur,
      shadow_offset_x: shadowOffsetX,
      shadow_offset_y: shadowOffsetY,
    });
    if (!response.success) {
      sendMessageToSandBox(false, REMOVE_BG_FAILED_ERR, TYPE_NOTIFY);
      setLoading(false);
      return;
    }

    setImageBytes(response.msg as Uint8Array);
    sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
    // A failed call carries no credit header, so there is no balance to report.
    if (response.updatedCredits != null) {
      sendMessageToSandBox(true, String(response.updatedCredits), TYPE_SET_BALANCE);
    }
    setLoading(false);
  };

  let btnTpe = null;
  let cb = () => {};
  if (isOffline) {
    // The offline banner explains why; leave cb as the no-op.
    btnTpe = BtnType.REMOVE_BG_DISABLED;
  } else if (imageBytes && imageBytes.length && gottenKey && !isCreditsInsufficient) {
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
    <div className="removebg-container">
      <ImageSelectionBanner
        isImageSelected={imageBytes && imageBytes.length > 0}
      />

      <div className="advanced-settings">
        <label
          className="settings-toggle"
          tabIndex={8}
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

        {showAdvancedSettings && (
          <div className="removebg-advanced-options">
            <SelectField
              label="Model"
              value={model}
              options={REMOVEBG_MODEL_OPTIONS}
              tabIndex={9}
              wide
              onChange={setModel}
            />
            <SelectField
              label="Output type"
              value={outputType}
              options={REMOVEBG_OUTPUT_TYPE_OPTIONS}
              tabIndex={10}
              onChange={setOutputType}
            />
            <SelectField
              label="Format"
              value={format}
              options={REMOVEBG_FORMAT_OPTIONS}
              tabIndex={11}
              onChange={setFormat}
            />

            {isCutout && (
              <>
                <SelectField
                  label="Scale"
                  value={scale}
                  options={REMOVEBG_SCALE_OPTIONS}
                  tabIndex={12}
                  onChange={setScale}
                />
                <NumberField
                  label="Background blur"
                  value={bgBlur}
                  min={REMOVEBG_PERCENT_MIN}
                  max={REMOVEBG_PERCENT_MAX}
                  tabIndex={13}
                  onChange={setBgBlur}
                />

                <div className="option-group wide">
                  <label className="option-label">Background color</label>
                  <input
                    className="option-input"
                    type="text"
                    value={bgColor}
                    tabIndex={14}
                    onChange={(e) => setBgColor(e.target.value)}
                    placeholder="e.g. #82d5fa or blue (optional)"
                  />
                </div>

                <label className="option-checkbox wide">
                  <input
                    type="checkbox"
                    checked={autoCenter}
                    tabIndex={15}
                    onChange={(e) => setAutoCenter(e.target.checked)}
                  />
                  <span>Auto-center subject</span>
                </label>

                <NumberField
                  label="Stroke size"
                  value={strokeSize}
                  min={REMOVEBG_PERCENT_MIN}
                  max={REMOVEBG_PERCENT_MAX}
                  tabIndex={16}
                  onChange={setStrokeSize}
                />

                {strokeSize > 0 && (
                  <>
                    <div className="option-group">
                      <label className="option-label">Stroke color</label>
                      <input
                        className="option-input"
                        type="text"
                        value={strokeColor}
                        tabIndex={17}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        placeholder="e.g. FFFFFF"
                      />
                    </div>
                    <NumberField
                      label="Stroke opacity"
                      value={strokeOpacity}
                      min={REMOVEBG_PERCENT_MIN}
                      max={REMOVEBG_PERCENT_MAX}
                      tabIndex={18}
                      onChange={setStrokeOpacity}
                    />
                  </>
                )}

                <SelectField
                  label="Shadow"
                  value={shadow}
                  options={REMOVEBG_SHADOW_OPTIONS}
                  tabIndex={19}
                  wide
                  onChange={setShadow}
                />

                {shadow !== REMOVEBG_SHADOW_DISABLED && (
                  <>
                    <NumberField
                      label="Shadow opacity"
                      value={shadowOpacity}
                      min={REMOVEBG_PERCENT_MIN}
                      max={REMOVEBG_PERCENT_MAX}
                      tabIndex={20}
                      onChange={setShadowOpacity}
                    />
                    <NumberField
                      label="Shadow blur"
                      value={shadowBlur}
                      min={REMOVEBG_PERCENT_MIN}
                      max={REMOVEBG_PERCENT_MAX}
                      tabIndex={21}
                      onChange={setShadowBlur}
                    />
                  </>
                )}

                {shadow === REMOVEBG_SHADOW_CUSTOM && (
                  <>
                    <NumberField
                      label="Shadow offset X"
                      value={shadowOffsetX}
                      min={REMOVEBG_OFFSET_MIN}
                      max={REMOVEBG_OFFSET_MAX}
                      tabIndex={22}
                      onChange={setShadowOffsetX}
                    />
                    <NumberField
                      label="Shadow offset Y"
                      value={shadowOffsetY}
                      min={REMOVEBG_OFFSET_MIN}
                      max={REMOVEBG_OFFSET_MAX}
                      tabIndex={23}
                      onChange={setShadowOffsetY}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Button type={btnTpe} cb={cb} tabIndex={24} />
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default RemoveBackground;
