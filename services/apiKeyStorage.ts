import { API_KEY_NAME } from "@constants/index";

export const readApiKey = async (
  pluginApi: PluginAPI
): Promise<string | undefined> => {
  try {
    const stored = await pluginApi.clientStorage.getAsync(API_KEY_NAME);
    return typeof stored === "string" && stored ? stored : undefined;
  } catch (error) {
    console.error("Failed to read the stored API key:", error);
    return undefined;
  }
};

export default readApiKey;
