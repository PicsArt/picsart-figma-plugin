import {
  TYPE_KEY,
  API_KEY_NAME,
  TYPE_TAB,
  TAB_GENERATE_IMAGE,
} from "@constants/index";
import { sendImageSelectionStatus } from "@services/ImageProcessor";
import { setMessageListeners } from "@services/MessageListeners";

const GenerateImageController = async () => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    height: apiKey ? 340 : 480,
  });

  setTimeout(() => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });

    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_GENERATE_IMAGE,
    });
    sendImageSelectionStatus();
    setMessageListeners(figma);
  }, 400);
};

export default GenerateImageController; 