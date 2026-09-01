import {
  API_KEY_NAME,
  TAB_ACCOUNT,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
} from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";
import openPanel from "./openPanel";

const AccountController = async () => {
  // Read once up front purely to size the window; openPanel reads it again for the
  // messages it sends.
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  setMessageListeners(figma);

  await openPanel({
    tab: TAB_ACCOUNT,
    height: apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY,
  });
};

export default AccountController;
