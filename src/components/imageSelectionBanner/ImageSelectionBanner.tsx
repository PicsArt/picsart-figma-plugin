import React from "react";
import { IMAGE_SELECTED, SELECT_IMAGE } from "@ui_constants/index";
import "./styles.scss";

interface Props {
  isImageSelected: boolean;
}

const ImageSelectionBanner: React.FC<Props> = ({ isImageSelected }) => {
  return (
    <div className="imageselectionbanner-container">
      {!isImageSelected ? (
        <>
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
          <span className="text">{SELECT_IMAGE}</span>
        </>
      ) : (
        <>
          <div className="check-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 15.9999C12.4183 15.9999 16 12.4182 16 7.9999C16 3.5816 12.4183 -0.00012207 8 -0.00012207C3.5817 -0.00012207 0 3.5816 0 7.9999C0 12.4182 3.5817 15.9999 8 15.9999ZM11.9111 6.3654L11.0889 5.6346L7.4764 9.6985L4.8889 7.1111L4.1111 7.8889L7.5236 11.3012L11.9111 6.3654Z"
                fill="#E543AA"
              />
            </svg>
          </div>
          <span className="text">{IMAGE_SELECTED}</span>
        </>
      )}
    </div>
  );
};

export default ImageSelectionBanner;
