import { TYPE_TAB } from "@constants/types";

const SupportController = async () => {
  figma.showUI(__html__, { visible: false });

  setTimeout(() => {
    figma.ui.postMessage({ type: TYPE_TAB, payload: "Supprot" });
  }, 300);
};

export default SupportController;
