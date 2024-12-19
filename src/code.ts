import { NO_INTERNET_ERR, NO_INTERNET_ERR_MSG, API_KEY_NAME, WIDGET_WIDTH } from "@constants/index";
import IntroController from "@controllers/IntroController"
import routeCommand from "@routes/CommandRouter"

figma.showUI(__html__, {visible: false, themeColors: true, width: WIDGET_WIDTH});
figma.ui.onmessage = ((response) => {
    if (response === NO_INTERNET_ERR) figma.closePlugin(NO_INTERNET_ERR_MSG);
})

figma.clientStorage.setAsync(API_KEY_NAME, '')

setTimeout(() => {
    figma.clientStorage.getAsync(API_KEY_NAME).then((key) => {
        if (!key) {
            console.log(1);
            IntroController();
        } else {
            console.log(2);

            routeCommand();
        }
    });
},0)


    


  