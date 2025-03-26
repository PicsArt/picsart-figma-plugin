import { COMMAND_INTRO, API_KEY_NAME, TYPE_COMMAND, WIDGET_WIDTH, WIDGET_HEIGHT_WITHOUT_KEY } from "@constants/index";
import routeCommand from "@routes/CommandRouter";

const IntroController = async () => {
    let commandIntro = { type: TYPE_COMMAND, command: COMMAND_INTRO } // IMPORTANT
    figma.showUI(__html__, {visible: true, themeColors: true, width: WIDGET_WIDTH , height: WIDGET_HEIGHT_WITHOUT_KEY});
  
    setTimeout(() => {
        figma.ui.postMessage(commandIntro);
        figma.ui.onmessage = (response) => {
            if (response.success) {
                figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
                    routeCommand();
                });
            } 
        };
    }, 300);
}


export default IntroController;