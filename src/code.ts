/// <reference types="@figma/plugin-typings" />
import {
  NO_INTERNET_ERR,
  NO_INTERNET_ERR_MSG,
  API_KEY_NAME,
  WIDGET_WIDTH,
  TYPE_IMAGEBYTES,
} from "@constants/index";
import IntroController from "@controllers/IntroController";
import routeCommand from "@routes/CommandRouter";
import ImageProcessor from "@services/ImageProcessor";

figma.showUI(__html__, {
  visible: false,
  themeColors: true,
  width: WIDGET_WIDTH,
});
figma.ui.onmessage = (response) => {
  if (response === NO_INTERNET_ERR) figma.closePlugin(NO_INTERNET_ERR_MSG);
};

setTimeout(async () => {
  figma.on("selectionchange", () => {
    sendImageSelectionStatus();
  });

  const sendImageSelectionStatus = async () => {
    figma.ui.postMessage({
      type: TYPE_IMAGEBYTES,
      payload: await ImageProcessor.processImage(figma),
    });
  };

  const key = await figma.clientStorage.getAsync(API_KEY_NAME);
  if (!key) {
    IntroController();
  } else {
    routeCommand();
  }
}, 0);
