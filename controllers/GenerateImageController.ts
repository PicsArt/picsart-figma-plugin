import { TAB_GENERATE_IMAGE, WIDGET_HEIGHT_GENERATE_IMAGE } from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";
import openPanel from "./openPanel";

const GenerateImageController = async () => {
  setMessageListeners(figma);

  await openPanel({
    tab: TAB_GENERATE_IMAGE,
    // One height regardless of key state: the panel is prompt-first, so it needs the
    // same room either way.
    height: WIDGET_HEIGHT_GENERATE_IMAGE,
  });
};

export default GenerateImageController;
