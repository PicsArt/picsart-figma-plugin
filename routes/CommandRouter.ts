import { UNKNOWN_COMMAND_ERR } from "@constants/errorMessages";
import ROUTES from "@constants/routes"

const routeCommand = () => {
    const command = figma.command;
    if (command in ROUTES) {
        const controller = ROUTES[command]
        controller();
    } else {
        figma.closePlugin(UNKNOWN_COMMAND_ERR);
    }
}

export default routeCommand;