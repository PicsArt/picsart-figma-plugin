import React from "react";
import { OFFLINE_WARNING } from "@ui_constants/index";
import "./styles.scss";

const OfflineBanner: React.FC = () => {
  return (
    <div className="offlinebanner-container">
      <div className="danger-icon">
        <svg
          width="20"
          height="18"
          viewBox="0 0 20 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10 0L20 18H0L10 0ZM9 11V7H11V11H9ZM9 13V15H11V13H9Z"
            fill="#E543AA"
          />
        </svg>
      </div>
      <span className="text">{OFFLINE_WARNING}</span>
    </div>
  );
};

export default OfflineBanner;
