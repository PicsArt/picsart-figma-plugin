import { PRICING } from "@constants/index";
import { BtnType } from "@app-types/enums";

export interface ActionButtonInput {
  isOffline: boolean;
  hasKey: boolean;
  /**
   * Whether this tab's own precondition is met: an image is selected for Remove BG
   * and Upscale, a prompt has been typed for Generate Image.
   */
  isReady: boolean;
  isCreditsInsufficient: boolean;
  active: BtnType;
  noCredits: BtnType;
  disabled: BtnType;
  onAction: () => void;
}

export interface ActionButtonState {
  btnType: BtnType;
  cb: () => void;
}

const noop = () => {};

/**
 * The one place the action-button state machine lives.
 *
 * Three components each carried their own copy of this if/else-if chain, and the
 * ordering between "no credits" and "not ready" is load-bearing: get it backwards
 * and a user with an empty selection is told to buy credits, or a user out of
 * credits gets an enabled button that spends a request to fail. Adding mode
 * awareness to Generate Image would have taken its copy to six branches.
 */
export const resolveActionButton = ({
  isOffline,
  hasKey,
  isReady,
  isCreditsInsufficient,
  active,
  noCredits,
  disabled,
  onAction,
}: ActionButtonInput): ActionButtonState => {
  // Offline wins over everything: the offline banner already explains why, so the
  // button says nothing extra and does nothing.
  if (isOffline) return { btnType: disabled, cb: noop };

  // Not ready outranks no-credits deliberately. "Add credits" is the wrong thing
  // to say to someone who simply has not selected a layer yet.
  if (!hasKey || !isReady) return { btnType: disabled, cb: noop };

  if (isCreditsInsufficient) {
    return {
      btnType: noCredits,
      cb: () => {
        window.open(PRICING, "_blank");
      },
    };
  }

  return { btnType: active, cb: onAction };
};

export default resolveActionButton;
