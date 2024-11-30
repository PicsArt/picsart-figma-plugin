import React from "react";
import "./styles.scss";

const LoadingSpinner: React.FC = () => {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
      <div className="icon-container">
      </div>
    </div>
  );
};

export default LoadingSpinner;
