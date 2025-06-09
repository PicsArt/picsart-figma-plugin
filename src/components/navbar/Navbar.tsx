import React, { useState } from "react";
import useOutsideClick from "@hooks/useOutsideClick";
import { REMOVE_BG_TAB, UPSCALE_TAB, TEXT_TO_IMAGE_TAB } from "@ui_constants/texts";
import { TabType } from "./../../types/enums";
import { HELP_CENTER } from "@constants/url";
import "./styles.scss";
import { sendMessageToSandBox } from "@api/index";
import { 
  TYPE_SWITCH_TAB,
  TAB_REMOVE_BACKGROUND,
  TAB_UPSCALE,
  TAB_ACCOUNT,
  TAB_SUPPORT,
  TAB_GENERATE_IMAGE,
  TAB_SET_API_KEY,
} from "@constants/index";

interface Props {
  gottenKey: string;
  tab: TabType;
}

const Navbar: React.FC<Props> = ({ gottenKey, tab }) => {
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const ref = useOutsideClick<HTMLDivElement>(() => setShowMenu(false));

  const getTabConstant = (tabType: TabType): string => {
    switch (tabType) {
      case TabType.REMOVE_BACKGROUND:
        return TAB_REMOVE_BACKGROUND;
      case TabType.UPSCALE:
        return TAB_UPSCALE;
      case TabType.TEXT_TO_IMAGE:
        return TAB_GENERATE_IMAGE;
      case TabType.ACCOUNT:
        return TAB_ACCOUNT;
      case TabType.SUPPORT:
        return TAB_SUPPORT;
      case TabType.SET_API_KEY:
        return TAB_SET_API_KEY;
      default:
        return TAB_REMOVE_BACKGROUND;
    }
  };

  const handleSelect = (option: TabType): void => {
    if (option === tab) return; // Don't switch if already on the same tab
    
    // Send switch tab message to close and reopen UI with proper height
    const tabConstant = getTabConstant(option);
    sendMessageToSandBox(true, "Switching tab", TYPE_SWITCH_TAB, undefined, { tab: tabConstant });
  };

  const handleMenuClick = () => {
    setShowMenu((prev) => !prev);
  };

  const handleMenuItemClick = (option: TabType) => {
    setShowMenu(false);
    handleSelect(option);
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
            <span onClick={() => handleMenuItemClick(TabType.SET_API_KEY)}>
              Set API Key
            </span>
            <span onClick={() => handleMenuItemClick(TabType.ACCOUNT)}>
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
