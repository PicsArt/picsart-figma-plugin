import React from "react";
import "./styles.scss";

const TextToImage: React.FC = () => {
  return (
    <div className="text-to-image">
      <span className="text">Generate Image</span>
      <div className="coming-soon">
        <div className="inner-container">
          <span>Coming Soon...</span>
        </div>
      </div>
    </div>
  );
};

export default TextToImage;
