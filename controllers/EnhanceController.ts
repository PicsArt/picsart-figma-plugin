import { getBalance } from "@api/index";
import {
  TYPE_KEY,
  API_KEY_NAME,
  TYPE_TAB,
  TAB_UPSCALE,
  TYPE_GET_BALANCE,
  WIDGET_HEIGHT_UPSCALE_WITH_KEY,
  WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
} from "@constants/index";
import CustomSessionStorage from "@services/CustomSessionStorage";
import { sendImageSelectionStatus } from "@services/ImageProcessor";
import { setMessageListeners } from "@services/MessageListeners";

const EnhanceController = async () => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    // The Upscale tab restores this height when its advanced panel closes, so
    // the two must stay in step — hence the shared constants.
    height: apiKey ? WIDGET_HEIGHT_UPSCALE_WITH_KEY : WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
  });

  setTimeout(async () => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });

    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_UPSCALE,
    });
    sendImageSelectionStatus();
    setMessageListeners(figma);
    
    const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
    if (apiKey && !sessionStorage.getCurrentSession()) {
      getBalance(apiKey).then((res) => {
        sessionStorage.setBalance(res.msg as number);
        sessionStorage.setCurrentSession();
        figma.ui.postMessage({
          type: TYPE_GET_BALANCE,
          payload: sessionStorage.getBalance(),
        });
      });
    }
  }, 400);
};

export default EnhanceController;
