import { TAB_SUPPORT } from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";
import openPanel from "./openPanel";

const SupportController = async () => {
  setMessageListeners(figma);

  await openPanel({
    tab: TAB_SUPPORT,
    // Hidden UI: this flow opens an external help-centre link and closes.
    visible: false,
    // Nothing on the Support tab reads the selection or the balance, so neither is
    // fetched. Both used to be skipped here too, just implicitly.
    includeImageSelection: false,
    includeBalance: false,
  });
};

export default SupportController;
