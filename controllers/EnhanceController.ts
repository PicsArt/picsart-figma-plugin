
import {
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_NOTIFY,
  API_KEY_NAME,
  TYPE_TAB,
  TAB_UPSCALE,
  KEY_SET,
  TYPE_SET_KEY,
} from "@constants/index";
import ImageProcessor, { sendImageSelectionStatus } from "@services/ImageProcessor";

const EnhanceController = async () => {
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
      payload: TAB_UPSCALE,
    });
    sendImageSelectionStatus();
    

    figma.ui.onmessage = (response) => {
      if (response.success) {
        if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
        if (response.type === TYPE_IMAGEBYTES) {
          ImageProcessor.setFetchedImage(response.msg, response.scaleFactor);
        }
        if (response.type === TYPE_SET_KEY) {
          figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
            figma.notify(KEY_SET);
          });
        }
      }
    };
  }, 400);
};

export default EnhanceController;
