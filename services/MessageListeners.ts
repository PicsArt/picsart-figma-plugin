import ImageProcessor from "@services/ImageProcessor";
import {
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  API_KEY_NAME,
  KEY_SET,
  TYPE_SET_KEY,
  TYPE_CLOSE_PLUGIN,
} from "@constants/index";

export const setMessageListeners = (figma : PluginAPI) => {
  figma.ui.onmessage = async (response) => {
    if (response.success) {
      if (response.type === TYPE_CLOSE_PLUGIN) figma.closePlugin();
      if (response.type === TYPE_NOTIFY) figma.notify(response.msg);
      if (response.type === TYPE_IMAGEBYTES) {
        const res = await ImageProcessor.setFetchedImage(
          response.msg,
          response.scaleFactor
        );
        figma.notify(res);
      }

      if (response.type === TYPE_SET_KEY) {
        figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
          figma.notify(KEY_SET);
        });
      }
    }
  };
};
