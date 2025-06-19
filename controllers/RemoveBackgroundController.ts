import { getBalance } from "@api/index";
import {
  API_KEY_NAME,
  TAB_REMOVE_BACKGROUND,
  TAB_REMOVE_BACKGROUND_INSTANTLY,
  TYPE_KEY,
  TYPE_TAB,
  TYPE_VALIDATE_KEY,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import {
  getImageSelectionStatus,
  sendImageSelectionStatus,
} from "@services/ImageProcessor";
import { setMessageListeners } from "@services/MessageListeners";
import CustomSessionStorage from "@services/CustomSessionStorage";

const RemoveBackgroundController = async (isFromIntroController: boolean) => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  figma.showUI(__html__, {
    visible: false,
    themeColors: true,
  });

  const validateKey = new Promise((resolve) => {
    setTimeout(() => {
      figma.ui.postMessage({
        type: TYPE_VALIDATE_KEY,
        payload: apiKey,
      });
      figma.ui.onmessage = (respone) => {
        if (respone.type === TYPE_VALIDATE_KEY) {
          resolve(respone.success);
        }
      };
    }, 400);
  });

  const isKeyValid = await validateKey;
  const imageSelectedStatus = await getImageSelectionStatus();
  if (isKeyValid && imageSelectedStatus && !isFromIntroController) {
    InstantlyRemove(apiKey);
  } else {
    removeWithUI(apiKey);
  }
  setMessageListeners(figma);
  const balance = await getBalance(apiKey);
  const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
  sessionStorage.setBalance(balance.msg as number);
};

const InstantlyRemove = async (apiKey: string) => {
  figma.showUI(__html__, {
    visible: false,
    themeColors: true,
  });

  setTimeout(() => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });
    sendImageSelectionStatus();
    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_REMOVE_BACKGROUND_INSTANTLY,
    });
  }, 400);
};

const removeWithUI = (apiKey: string) => {
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
    sendImageSelectionStatus();
    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_REMOVE_BACKGROUND,
    });
  }, 400);
};

export default RemoveBackgroundController;
