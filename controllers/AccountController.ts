import {
  TAB_ACCOUNT,
  WIDGET_HEIGHT_ACCOUNT,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import { activeCredential } from "@services/authSession";
import { setMessageListeners } from "@services/MessageListeners";
import openPanel from "./openPanel";

const AccountController = async () => {
  // Read once up front purely to size the window; openPanel reads it again for the
  const { credential } = await activeCredential(figma);

  setMessageListeners(figma);

  await openPanel({
    tab: TAB_ACCOUNT,
    height: credential ? WIDGET_HEIGHT_ACCOUNT : WIDGET_HEIGHT_WITHOUT_KEY,
  });
};

export default AccountController;
