import { KEY_SET, COMMAND_CHANGE_API_KEY , API_KEY_NAME, TYPE_COMMAND, WIDGET_WIDTH } from "@constants/index";

const ChangeApiKeyController = async () => {
    let commandObj = { type: TYPE_COMMAND, command: COMMAND_CHANGE_API_KEY } // IMPORTANT
    figma.showUI(__html__, {visible: true, themeColors: true, width: WIDGET_WIDTH , height: 180});
  
    setTimeout(() => {
        figma.ui.postMessage(commandObj);
        figma.ui.onmessage = (response) => {
            if (response.success) {
                figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
                    figma.notify(KEY_SET);
                });
            } else {
                figma.notify(response.msg);
            }
        };
    }, 500);
}


export default ChangeApiKeyController;