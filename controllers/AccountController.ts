import { API_KEY_NAME, WIDGET_WIDTH } from "@constants/env";
import { TYPE_COMMAND, TYPE_KEY } from "@constants/types";
import ChangeApiKeyController from '../controllers/ChangeApiKeyController'

const AccountController = async () => {
    const command = figma.command;
    let commandObj = { type: TYPE_COMMAND, command}
    figma.showUI(__html__, {visible: true, themeColors: true, width: WIDGET_WIDTH, height: 160 });

    figma.clientStorage.getAsync(API_KEY_NAME).then((apiKey) => {
      setTimeout(() => {
        figma.ui.postMessage({ type: TYPE_KEY, "api_key": apiKey });
        figma.ui.postMessage(commandObj);

        figma.ui.onmessage = (response) => {
          if (response.success ) {
            if (response.msg == 'openKeyChangePage') {
              ChangeApiKeyController();
            }
          } else {
            figma.notify(response.msg);            
          }
        };
      }, 500);
    });
}


export default AccountController;