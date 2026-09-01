import {
  API_KEY_NAME,
  TAB_REMOVE_BACKGROUND,
  TAB_REMOVE_BACKGROUND_INSTANTLY,
  TYPE_VALIDATE_KEY,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import { describeSelection } from "@services/ImageProcessor";
import { setMessageListeners } from "@services/MessageListeners";
import {
  addUiMessageHandler,
  beginUiSession,
  postToUi,
  removeUiMessageHandler,
} from "@services/UiBridge";
import openPanel from "./openPanel";

/**
 * Ask the UI whether the stored key still works.
 *
 * The UI owns this because only the iframe can reach the network. This used to be a
 * promise wrapped around `setTimeout(..., 400)` that assigned `figma.ui.onmessage`
 * directly — and that assignment was later overwritten by setMessageListeners, so
 * the handler resolving this promise stopped existing partway through the boot. It
 * now registers alongside the others and removes only itself when done.
 */
const VALIDATE_KEY_TIMEOUT_MS = 8000;

const validateKey = (apiKey: string): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;

    const settle = (isValid: boolean) => {
      if (settled) return;
      settled = true;
      removeUiMessageHandler(handler);
      resolve(isValid);
    };

    const handler = (response: { type?: string; success?: boolean }) => {
      if (response.type !== TYPE_VALIDATE_KEY) return;
      settle(!!response.success);
    };

    addUiMessageHandler(figma, handler);
    postToUi(figma, { type: TYPE_VALIDATE_KEY, payload: apiKey });

    // Nothing after this point runs until the promise settles, so an answer that
    // never comes — an offline user, a stalled balance request — would leave the
    // plugin sitting on a hidden UI with no panel and no error. Treated as "not
    // validated", which routes to the normal panel rather than the instant flow.
    setTimeout(() => {
      if (!settled) {
        console.warn("Key validation did not answer in time; showing the panel.");
      }
      settle(false);
    }, VALIDATE_KEY_TIMEOUT_MS);
  });

const RemoveBackgroundController = async (isFromIntroController: boolean) => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  // First pass: a hidden UI, purely to run the key check. The panel is not shown
  // until the destination is known, so the user never sees a tab appear and change.
  figma.showUI(__html__, { visible: false, themeColors: true });
  beginUiSession(figma);
  setMessageListeners(figma);

  const isKeyValid = await validateKey(apiKey);

  // Asks the descriptor whether an image is selected rather than decoding the whole
  // image to answer a yes/no question, which is what this did on every launch.
  const selected = describeSelection(figma);
  const canRemoveInstantly = isKeyValid && !!selected?.hasImageFill && !isFromIntroController;

  await openPanel({
    tab: canRemoveInstantly ? TAB_REMOVE_BACKGROUND_INSTANTLY : TAB_REMOVE_BACKGROUND,
    // The instant flow has no panel: it runs one call and closes the plugin.
    visible: !canRemoveInstantly,
    ...(canRemoveInstantly
      ? {}
      : { height: apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY }),
  });
};

export default RemoveBackgroundController;
