// import imageProcessor from "@services/ImageProcessor";
// import { NO_IMAGE_IN_NODE_ERR, NO_NODE_SELECTED_ERR, TYPE_COMMAND, TYPE_IMAGEBYTES, TYPE_KEY, TYPE_NOTIFY, API_KEY_NAME, WIDGET_WIDTH } from "@constants/index";

// const EnhanceController = () => {
//     const command = figma.command;
//     let commandObj = { type: TYPE_COMMAND, command}

//     if (figma.currentPage.selection.length !== 1) {
//         figma.closePlugin(NO_NODE_SELECTED_ERR);
//     }
//     figma.showUI(__html__, {visible: true, themeColors: true, width: WIDGET_WIDTH, height: 170 });

//     figma.clientStorage.getAsync(API_KEY_NAME).then((apiKey) => {
//       if (apiKey) {
//         imageProcessor.processImage(figma).then((imageBytes : Uint8Array | undefined) => {
//           setTimeout(() => {
//             figma.ui.postMessage({ type: TYPE_KEY, "api_key": apiKey });

//             if (imageBytes) {
//               figma.ui.postMessage({ type: TYPE_IMAGEBYTES, buffer: imageBytes });
//               figma.ui.postMessage(commandObj);

//               figma.ui.onmessage = ((response) => {
//                 if (response.success) {
//                   if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
//                   if (response.type === TYPE_IMAGEBYTES) {
//                     imageProcessor.setFetchedImage(response.msg, response.scaleFactor)
//                   }
//                 } else {
//                   figma.closePlugin(response.msg);
//                 }
//               })
//             }
//             else figma.closePlugin(NO_IMAGE_IN_NODE_ERR);
//           }, 400);
//         })
//     } else {
//       figma.closePlugin();
//     }
//   });
// }

// export default EnhanceController;

import {
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_NOTIFY,
  API_KEY_NAME,
  TYPE_TAB,
  TAB_UPSCALE,
  KEY_SET,
  TYPE_SET_KEY,
} from "@constants/index";
import ImageProcessor from "@services/ImageProcessor";

const EnhanceController = async () => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    height: apiKey ? 340 : 480,
  });

  setTimeout(() => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });

    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: TAB_UPSCALE,
    });

    figma.ui.onmessage = (response) => {
      if (response.success) {
        if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
        if (response.type === TYPE_IMAGEBYTES) {
          ImageProcessor.setFetchedImage(response.msg, response.scaleFactor);
        }
        if (response.type === TYPE_SET_KEY) {
          figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
            figma.notify(KEY_SET);
            figma.closePlugin();
          });
        }
      }
    };
  }, 400);
};

export default EnhanceController;
