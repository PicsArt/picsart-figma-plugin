import React from "react";
import {
  EDIT_MODE_EMPTY,
  EDIT_MODE_NO_IMAGE,
  EDIT_MODE_READY,
  IMAGE_SELECTED,
  SELECT_IMAGE,
  SELECTION_CHECKING,
  SELECTION_NO_IMAGE,
  selectionMultiNote,
} from "@ui_constants/index";
import { BannerStance } from "@app-types/enums";
import type { SelectionState } from "@app-types/messages";
import "./styles.scss";

interface Props {
  selection: SelectionState;
  /**
   * Whether an empty selection blocks the tab or picks a mode. Required rather than
   * defaulted: getting it wrong is a wrong glyph on a paid decision, and the two
   * tabs that block and the one that does not should each have to say so.
   */
  stance: BannerStance;
}

const DangerIcon = () => (
  <div className="danger-icon">
    <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 0L20 18H0L10 0ZM9 11V7H11V11H9ZM9 13V15H11V13H9Z"
        fill="currentColor"
      />
    </svg>
  </div>
);

const CheckIcon = () => (
  <div className="check-icon">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 15.9999C12.4183 15.9999 16 12.4182 16 7.9999C16 3.5816 12.4183 -0.00012207 8 -0.00012207C3.5817 -0.00012207 0 3.5816 0 7.9999C0 12.4182 3.5817 15.9999 8 15.9999ZM11.9111 6.3654L11.0889 5.6346L7.4764 9.6985L4.8889 7.1111L4.1111 7.8889L7.5236 11.3012L11.9111 6.3654Z"
        fill="currentColor"
      />
    </svg>
  </div>
);

const InfoIcon = () => (
  <div className="info-icon">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 16C12.4183 16 16 12.4183 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 12.4183 3.58172 16 8 16ZM7 4H9V6H7V4ZM7 7H9V12H7V7Z"
        fill="currentColor"
      />
    </svg>
  </div>
);

/**
 * Four states, not two.
 *
 * The previous version took a single boolean derived from the byte length of the
 * selected image, so it could only say "selected" or "not selected". That
 * collapsed two genuinely different situations into the wrong message: the 400ms
 * gap before the sandbox has reported anything (shown as "not selected" on every
 * launch, with an image selected), and a layer that is selected but holds no
 * image (shown as "select an image" to someone who just selected a layer).
 */
const ImageSelectionBanner: React.FC<Props> = ({ selection, stance }) => {
  const multiNote =
    (selection.kind === "image" || selection.kind === "no-image") &&
    selection.descriptor.selectionCount > 1
      ? selectionMultiNote(selection.descriptor.name, selection.descriptor.selectionCount)
      : null;

  const informational = stance === BannerStance.INFORMATIONAL;

  const content = () => {
    switch (selection.kind) {
      case "unknown":
        return { className: "is-checking", icon: <InfoIcon />, text: SELECTION_CHECKING };
      case "image":
        return {
          className: "is-selected",
          icon: <CheckIcon />,
          text: informational ? EDIT_MODE_READY : IMAGE_SELECTED,
        };
      case "no-image":
        // Informational: the layer is unusable as an edit source, but text-to-image
        // still works, so this narrows the mode rather than blocking the tab.
        return informational
          ? { className: "is-mode", icon: <InfoIcon />, text: EDIT_MODE_NO_IMAGE }
          : { className: "is-wrong-type", icon: <DangerIcon />, text: SELECTION_NO_IMAGE };
      case "none":
      default:
        return informational
          ? { className: "is-mode", icon: <InfoIcon />, text: EDIT_MODE_EMPTY }
          : { className: "is-empty", icon: <DangerIcon />, text: SELECT_IMAGE };
    }
  };

  const { className, icon, text } = content();

  return (
    <div
      className={`imageselectionbanner-container ${className}`}
      // Selecting a layer on the canvas is not an action inside this panel, so
      // without a live region a screen reader user gets no notification that the
      // banner — the only signal that the plugin noticed — has changed.
      role="status"
      aria-live="polite"
    >
      {icon}
      <span className="text">{text}</span>
      {multiNote && <span className="multi-note">{multiNote}</span>}
    </div>
  );
};

export default ImageSelectionBanner;
