import { TAB_SUPPORT, TYPE_TAB } from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";

const SupportController = async () => {
  figma.showUI(__html__, { visible: false });

  setTimeout(() => {
    figma.ui.postMessage({ type: TYPE_TAB, payload: TAB_SUPPORT });
    setMessageListeners(figma);
  }, 400);
};

export default SupportController;
