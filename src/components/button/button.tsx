import React from "react";
import "./styles.scss";
import {
  ADD_CREDITS_BTN_TEXT,
  BUY_MORE_BTN_TEXT,
  CHANGE_KEY_BTN_TEXT,
  CONTINUE_BTN_TEXT,
  GET_NEW_KEY_BTN_TEXT,
  REMOVE_BG_BTN_TEXT,
  REMOVE_BG_NO_CREDITS_BTN_TEXT,
  SUBMIT_KEY_BTN_TEXT,
  UPSCALE_BTN_TEXT,
  UPSCALE_NO_CREDITS_BTN_TEXT,
  GENERATE_IMAGE_BTN_TEXT,
  GENERATE_IMAGE_NO_CREDITS_BTN_TEXT,
} from "@ui_constants/texts";

import { BtnType } from "./../../types/enums";

interface Props {
  type: BtnType;
  cb?: (factor?: string) => void;
}

const btnTypes: Record<BtnType, string> = {
  [BtnType.REMOVE_BG_ACTIVE]: REMOVE_BG_BTN_TEXT,
  [BtnType.REMOVE_BG_DISABLED]: REMOVE_BG_BTN_TEXT,
  [BtnType.REMOVE_BG_NO_CREDITS]: REMOVE_BG_NO_CREDITS_BTN_TEXT,
  [BtnType.UPSCALE_ACTIVE]: UPSCALE_BTN_TEXT,
  [BtnType.UPSCALE_NO_CREDITS]: UPSCALE_NO_CREDITS_BTN_TEXT,
  [BtnType.UPSCALE_DISABLED]: UPSCALE_BTN_TEXT,
  [BtnType.GENERATE_IMAGE_ACTIVE]: GENERATE_IMAGE_BTN_TEXT,
  [BtnType.GENERATE_IMAGE_NO_CREDITS]: GENERATE_IMAGE_NO_CREDITS_BTN_TEXT,
  [BtnType.GENERATE_IMAGE_DISABLED]: GENERATE_IMAGE_BTN_TEXT,
  [BtnType.CONTINUE]: CONTINUE_BTN_TEXT,
  [BtnType.BUY_MORE]: BUY_MORE_BTN_TEXT,
  [BtnType.CHANGE_KEY]: CHANGE_KEY_BTN_TEXT,
  [BtnType.NEW_KEY]: GET_NEW_KEY_BTN_TEXT,
  [BtnType.SUBMIT_ACTIVE]: SUBMIT_KEY_BTN_TEXT,
  [BtnType.SUBMIT_DISABLED]: SUBMIT_KEY_BTN_TEXT,
  [BtnType.ADD_CREDITS]: ADD_CREDITS_BTN_TEXT,
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
