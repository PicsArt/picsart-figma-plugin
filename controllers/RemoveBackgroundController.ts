import {
  API_KEY_NAME,
  KEY_SET,
  TAB_REMOVE_BACKGROUND,
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_NOTIFY,
  TYPE_SET_KEY,
  TYPE_TAB,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import ImageProcessor, { sendImageSelectionStatus } from "@services/ImageProcessor";

const RemoveBackgroundController = async () => {
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
      payload: TAB_REMOVE_BACKGROUND,
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

export default RemoveBackgroundController;
