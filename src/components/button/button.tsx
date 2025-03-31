import React from "react";
import "./styles.scss";
import {
  BUY_MORE_BTN_TEXT,
  CHANGE_KEY_BTN_TEXT,
  CONTINUE_BTN_TEXT,
  GET_NEW_KEY_BTN_TEXT,
  REMOVE_BG_BTN_TEXT,
  SUBMIT_KEY_BTN_TEXT,
  UPSCALE_BTN_TEXT,
} from "@ui_constants/texts";

import { BtnType } from "./../../types/enums";

interface Props {
  type: BtnType;
  cb?: (factor?: string) => void;
}

const btnTypes: Record<BtnType, string> = {
  "remove-bg-active": REMOVE_BG_BTN_TEXT,
  "remove-bg-disabled": REMOVE_BG_BTN_TEXT,
  "upscale-active": UPSCALE_BTN_TEXT,
  "upscale-disabled": UPSCALE_BTN_TEXT,
  continue: CONTINUE_BTN_TEXT,
  "buy-more": BUY_MORE_BTN_TEXT,
  "change-key": CHANGE_KEY_BTN_TEXT,
  "new-key": GET_NEW_KEY_BTN_TEXT,
  "submit-active": SUBMIT_KEY_BTN_TEXT,
  "submit-disabled": SUBMIT_KEY_BTN_TEXT,
};

const button: React.FC<Props> = ({ type, cb }) => {
  return (
    <div
      onClick={() => (cb ? cb() : void 0)}
      className={`btn-container ${type}`}
    >
      <span>{btnTypes[type]}</span>
    </div>
  );
};

export default button;
