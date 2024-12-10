import { TYPE_COMMAND} from "@constants/types";

const SupportController = async () => {
  const command = figma.command;
  let commandObj = { type: TYPE_COMMAND, command}
  
  figma.showUI(__html__, {visible: false});
  
  setTimeout(() => {
    figma.ui.postMessage(commandObj);
    setTimeout(() => {
      figma.closePlugin();
    }, 300);
  }, 300);

}


export default SupportController;