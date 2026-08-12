import React from "react";
import "./styles.scss";

interface Props {
  /**
   * What is happening. Optional so the existing call sites keep working, but pass it
   * wherever the wait is a paid job: a 10-60 second call behind an unlabelled 60%
   * black scrim with a spinning ring tells the user nothing about whether it is still
   * alive, and there is no cancel control to reach for either.
   */
  message?: string;
}

const LoadingSpinner: React.FC<Props> = ({ message }) => {
  return (
    <div
      className="loading-spinner-container"
      // A scrim with no accessible name is invisible to a screen reader, so a user
      // gets no indication that the panel has become busy — only that every control
      // stopped responding.
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-spinner"></div>
      {message && <p className="loading-message">{message}</p>}
      <div className="icon-container">
      </div>
    </div>
  );
};

export default LoadingSpinner;
