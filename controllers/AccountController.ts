import { sendImageSelectionStatus } from "@services/ImageProcessor";
import {
  TAB_ACCOUNT,
  TYPE_KEY,
  TYPE_TAB,
  API_KEY_NAME,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";

const AccountController = async () => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    height: apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY,
  });

  setTimeout(() => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });

    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_ACCOUNT,
    });
    sendImageSelectionStatus();
    setMessageListeners(figma);
  }, 400);
};

export default AccountController;
