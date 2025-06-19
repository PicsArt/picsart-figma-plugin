import commands from "@constants/commands";
import {
  API_KEY_NAME,
  WIDGET_WIDTH,
  WIDGET_HEIGHT_WITHOUT_KEY,
  TYPE_TAB,
  TAB_REMOVE_BACKGROUND,
  TYPE_SET_KEY,
  TYPE_SET_BALANCE,
} from "@constants/index";
import routeCommand from "@routes/CommandRouter";
import { sendImageSelectionStatus } from "@services/ImageProcessor";
import { UPSCALE_TAB } from "@ui_constants/texts";
import CustomSessionStorage from "../services/CustomSessionStorage";

const IntroController = async () => {
  if (figma.command === commands.COMMAND_SUPPORT) {
    routeCommand();
    return;
  }
  const postMsg = {
    type: TYPE_TAB,
    payload:
      figma.command === commands.COMMAND_REMOVEBACKGROUND
        ? TAB_REMOVE_BACKGROUND
        : UPSCALE_TAB,
  };
  
  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT_WITHOUT_KEY,
  });

  setTimeout(() => {
    figma.ui.postMessage(postMsg);
    sendImageSelectionStatus();
    figma.ui.onmessage = (response) => {
      if (response.success) {
        if (response.type === TYPE_SET_KEY) {
          figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
            routeCommand(true);
          });
        } else if (response.type === TYPE_SET_BALANCE) {
          const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
          sessionStorage.setBalance(response.msg as number);
        }
      }
    };
  }, 300);
};

export default IntroController;
