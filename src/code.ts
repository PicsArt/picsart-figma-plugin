/// <reference types="@figma/plugin-typings" />
import { API_KEY_NAME } from "@constants/index";
import IntroController from "@controllers/IntroController";
import routeCommand from "@routes/CommandRouter";
import { sendImageSelectionStatus } from "@services/ImageProcessor";

figma.showUI(__html__, { visible: false });

// Need to take time while UI is drawing that you can postmessage with it 
setTimeout(async () => {
  figma.on("selectionchange", () => {
    sendImageSelectionStatus();
  });

  const key = await figma.clientStorage.getAsync(API_KEY_NAME);

  if (!key) {
    IntroController();
  } else {
    routeCommand();
  }
}, 0);
