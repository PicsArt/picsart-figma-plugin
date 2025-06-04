import React, { useState } from "react";
import useOutsideClick from "@hooks/useOutsideClick";
import { REMOVE_BG_TAB, UPSCALE_TAB, TEXT_TO_IMAGE_TAB } from "@ui_constants/texts";
import { TabType } from "./../../types/enums";
import { HELP_CENTER } from "@constants/url";
import "./styles.scss";
import { sendMessageToSandBox } from "@api/index";
import { TYPE_TEXT_TO_IMAGE_TAB } from "@constants/types";

interface Props {
  gottenKey: string;
  tab: TabType;
  changeTab: (tab: TabType) => void;
}

const Navbar: React.FC<Props> = ({ gottenKey, tab, changeTab }) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setShowMenu(false));

  const handleSelect = (option: TabType): void => {
    changeTab(option);
  };

  const handleMenuClick = () => {
    if (tab === TabType.TEXT_TO_IMAGE) {
      sendMessageToSandBox(
        true,
        "Generate Image",
        TYPE_TEXT_TO_IMAGE_TAB,
      );
    }
    setShowMenu((prev) => !prev);
  };

  return (
    <div className="navbar-container">
      <div className="options-container">
        <span
          className={`option ${
            tab === TabType.REMOVE_BACKGROUND ? "selected" : ""
          }`}
          onClick={() => handleSelect(TabType.REMOVE_BACKGROUND)}
        >
          {REMOVE_BG_TAB}
        </span>
        <span
          className={`option ${
            tab === TabType.UPSCALE ? "selected" : ""
          }`}
          onClick={() => handleSelect(TabType.UPSCALE)}
        >
          {UPSCALE_TAB}
        </span>
        <span
          className={`option ${
            tab === TabType.TEXT_TO_IMAGE ? "selected" : ""
          }`}
          onClick={() => handleSelect(TabType.TEXT_TO_IMAGE)}
        >
          {TEXT_TO_IMAGE_TAB}
        </span>
      </div>
      <div className="hamburger-menu" onClick={handleMenuClick}>
        <div className="hamburger-menu-icon">
          <svg
            width="14"
            height="12"
            viewBox="0 0 14 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M14 0H0V1H14V0Z" fill="#333333" />
            <path d="M0 5.5H14V6.5H0V5.5Z" fill="#333333" />
            <path d="M0 11H14V12H0V11Z" fill="#333333" />
          </svg>
        </div>
        {gottenKey && showMenu && (
          <div ref={ref} className="hamburger-menu-hidden-content">
            <span onClick={() => changeTab(TabType.SET_API_KEY)}>
              Set API Key
            </span>
            <span onClick={() => changeTab(TabType.ACCOUNT)}>
              Account Balance
            </span>
            <span onClick={() => window.open(HELP_CENTER, "_blank")}>
              Support
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
