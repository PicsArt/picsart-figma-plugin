/// <reference types="@figma/plugin-typings" />
import {
  NO_INTERNET_ERR,
  NO_INTERNET_ERR_MSG,
  API_KEY_NAME,
} from "@constants/index";
import IntroController from "@controllers/IntroController";
import routeCommand from "@routes/CommandRouter";
import { sendImageSelectionStatus } from "@services/ImageProcessor";

figma.showUI(__html__, { visible: false });
figma.ui.onmessage = (response) => {
  if (response === NO_INTERNET_ERR) figma.closePlugin(NO_INTERNET_ERR_MSG);
};

// figma.notify("⚠️ Your balance is not enough to remove the background.", { 
//   button: {
//     text: "➕ Add Credits",
//     action: () => {
//       figma.ui.postMessage({ type: "open-link" });
//     }
//   }
// });

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
