import {
  API_KEY_NAME,
  TAB_UPSCALE,
  WIDGET_HEIGHT_UPSCALE_WITH_KEY,
  WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
} from "@constants/index";
import { setMessageListeners } from "@services/MessageListeners";
import openPanel from "./openPanel";

const EnhanceController = async () => {
  const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);

  setMessageListeners(figma);

  await openPanel({
    tab: TAB_UPSCALE,
    // The Upscale tab restores this height when its advanced panel closes, so the
    // two must stay in step — hence the shared constants.
    height: apiKey ? WIDGET_HEIGHT_UPSCALE_WITH_KEY : WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
  });
};

export default EnhanceController;
