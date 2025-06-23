import ImageProcessor from "@services/ImageProcessor";
import { sendImageSelectionStatus } from "@services/ImageProcessor";
import AccountController from "../controllers/AccountController";
import SupportController from "../controllers/SupportController";
import GenerateImageController from "../controllers/GenerateImageController";
import CustomSessionStorage from "./CustomSessionStorage";
import {
  TYPE_IMAGEBYTES,
  TYPE_NOTIFY,
  API_KEY_NAME,
  KEY_SET,
  TYPE_SET_KEY,
  TYPE_CLOSE_PLUGIN,
  TYPE_GENERATED_IMAGES,
  TYPE_SWITCH_TAB,
  TAB_REMOVE_BACKGROUND,
  TAB_UPSCALE,
  TAB_ACCOUNT,
  TAB_SUPPORT,
  TAB_GENERATE_IMAGE,
  TAB_SET_API_KEY,
  TYPE_KEY,
  TYPE_TAB,
  WIDGET_HEIGHT_WITH_KEY,
  WIDGET_HEIGHT_WITHOUT_KEY,
  WIDGET_HEIGHT_UPSCALE_WITH_KEY,
  WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
  TYPE_SET_BALANCE,
  TYPE_GET_BALANCE,
} from "@constants/index";
import { getBalance } from "@api/index";


// Helper function to reduce code duplication in tab switching
const showUIForTab = (apiKey: string, height: number, tabValue: string, includeImageSelection = true) => {
  figma.showUI(__html__, {
    visible: true,
    themeColors: true,
    height,
  });

  setTimeout(async () => {
    figma.ui.postMessage({
      type: TYPE_KEY,
      payload: apiKey,
    });
    
    if (includeImageSelection) {
      sendImageSelectionStatus();
    }
    
    figma.ui.postMessage({
      type: TYPE_TAB,
      payload: tabValue,
    });
    
    const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();

    if (apiKey && !sessionStorage.getCurrentSession()) {
      const balance = await getBalance(apiKey);
      sessionStorage.setBalance(balance.msg as number);
      sessionStorage.setCurrentSession();
    }
  }, 400);
};

// Mapping from TAB constants to UI TabType enum values
const getTabUIValue = (tabConstant: string): string => {
  switch (tabConstant) {
    case TAB_REMOVE_BACKGROUND:
      return "Remove BG";
    case TAB_UPSCALE:
      return "Upscale";
    case TAB_SET_API_KEY:
      return "Set API Key";
    case TAB_GENERATE_IMAGE:
      return "Generate image";
    case TAB_ACCOUNT:
      return "Account Balance";
    case TAB_SUPPORT:
      return "Support";
    default:
      return "Remove BG";
  }
};

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

      if (response.type === TYPE_GENERATED_IMAGES) {
        const res = await ImageProcessor.addGeneratedImages(
          response.images,
          response.prompt
        );
        figma.notify(res);
      }

      if (response.type === TYPE_SWITCH_TAB) {
        // Small delay to ensure any pending operations complete before switching
        setTimeout(async () => {
          try {
            const apiKey = await figma.clientStorage.getAsync(API_KEY_NAME);
            
            switch (response.tab) {
              case TAB_REMOVE_BACKGROUND:
                showUIForTab(
                  apiKey, 
                  apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY,
                  getTabUIValue(TAB_REMOVE_BACKGROUND)
                );
                break;
                
              case TAB_UPSCALE:
                showUIForTab(
                  apiKey,
                  apiKey ? WIDGET_HEIGHT_UPSCALE_WITH_KEY : WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
                  getTabUIValue(TAB_UPSCALE)
                );
                break;
                
              case TAB_SET_API_KEY:
                showUIForTab(
                  apiKey,
                  apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY,
                  getTabUIValue(TAB_SET_API_KEY)
                );
                break;
                
              case TAB_ACCOUNT:
                AccountController();
                break;
                
              case TAB_SUPPORT:
                SupportController();
                break;
                
              case TAB_GENERATE_IMAGE:
                GenerateImageController();
                break;
                
              default:
                // Fallback to remove background
                showUIForTab(
                  apiKey,
                  apiKey ? WIDGET_HEIGHT_WITH_KEY : WIDGET_HEIGHT_WITHOUT_KEY,
                  getTabUIValue(TAB_REMOVE_BACKGROUND)
                );
            }
          } catch (error) {
            console.error('Error during tab switch:', error);
            figma.notify('Failed to switch tab');
          }
        }, 100);
        
        return; // Exit early to avoid other processing
      }

      if (response.type === TYPE_SET_KEY) {
        figma.clientStorage.setAsync(API_KEY_NAME, response.msg).then(() => {
          figma.notify(KEY_SET);
        });
      }
      if (response.type === TYPE_SET_BALANCE) {
        const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
        sessionStorage.setBalance(response.msg);
        figma.ui.postMessage({
          type: TYPE_GET_BALANCE,
          payload: sessionStorage.getBalance(),
        });
      }

      if (response.type === TYPE_GET_BALANCE) {
        const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
        figma.ui.postMessage({
          type: TYPE_GET_BALANCE,
          payload: sessionStorage.getBalance(),
        });
      }
    }
  };
};
