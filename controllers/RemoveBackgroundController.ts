import imageProcessor from "@services/ImageProcessor";
import { API_KEY_NAME, NO_IMAGE_IN_NODE_ERR, NODE_NOT_SELECTED_ERR, TYPE_COMMAND, TYPE_IMAGEBYTES, TYPE_KEY, TYPE_NOTIFY } from "@constants/index";

const RemoveBackgroundController = () => {
    const command = figma.command;
    let commandObj = { type: TYPE_COMMAND, command}

    if (figma.currentPage.selection.length !== 1) {
      figma.closePlugin(NODE_NOT_SELECTED_ERR);
    }
    
    figma.showUI(__html__, {visible: false});
    figma.clientStorage.getAsync(API_KEY_NAME).then((apiKey) => {
      imageProcessor.processImage(figma).then((imageBytes : Uint8Array | undefined) => {
        setTimeout(() => {
          figma.ui.postMessage({ type: TYPE_KEY, "api_key": apiKey });
          
          if (imageBytes) {
            figma.ui.postMessage({ type: TYPE_IMAGEBYTES, buffer: imageBytes }); 
            figma.ui.postMessage(commandObj);

            figma.ui.onmessage = ((response) => {
              if (response.success) {
                if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
                if (response.type === TYPE_IMAGEBYTES) {
                  imageProcessor.setFetchedImage(response.msg, response.scaleFactor)
                } 
              } else {
                figma.closePlugin(response.msg);
              }
            })
          } 
          else figma.closePlugin(NO_IMAGE_IN_NODE_ERR);
        }, 300);
      })
    });
}


export default RemoveBackgroundController;