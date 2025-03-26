import ImageProcessor from "@services/ImageProcessor";
import {
  TAB_ACCOUNT,
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_NOTIFY,
  TYPE_TAB,
  API_KEY_NAME,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
  KEY_SET,
  TYPE_SET_KEY,
} from "@constants/index";

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

    figma.ui.onmessage = (response) => {
      if (response.success) {
        if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
        if (response.type === TYPE_IMAGEBYTES) {
          ImageProcessor.setFetchedImage(response.msg, response.scaleFactor);
        }
        if (response.type === TYPE_SET_KEY) {
          console.log(response.msg)
          figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
            figma.notify(KEY_SET);
          });
        }
      }
    };
  }, 400);
};

export default AccountController;
