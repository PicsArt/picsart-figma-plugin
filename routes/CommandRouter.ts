import { UNKNOWN_COMMAND_ERR } from "@constants/errorMessages";
import ROUTES from "@constants/routes"

const routeCommand = (isFromIntroController: boolean = false) => {
    const command = figma.command;
    if (command in ROUTES) {
        const controller = ROUTES[command]
        controller(isFromIntroController);
    } else {
        figma.closePlugin(UNKNOWN_COMMAND_ERR);
    }
}

export default routeCommand;