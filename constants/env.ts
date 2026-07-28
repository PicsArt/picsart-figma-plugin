export const API_KEY_NAME = "picsart_api_key"
export const WIDGET_WIDTH = 320;
export const WIDGET_HEIGHT_WITH_KEY = 300;
export const WIDGET_HEIGHT_WITHOUT_KEY = 450;
export const WIDGET_HEIGHT_ACCOUNT_PAGE = 260;
export const WIDGET_HEIGHT_GENERATE_IMAGE = 575;
export const WIDGET_HEIGHT_UPSCALE_WITH_KEY = 340;
export const WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY = 480;

// Heights requested while an advanced-settings panel is open. The window grows
// so the extra controls fit; if the screen cannot accommodate the request,
// Figma clamps it and .scrollable-content scrolls instead.
export const WIDGET_HEIGHT_REMOVE_BG_ADVANCED = 690;
export const WIDGET_HEIGHT_UPSCALE_ADVANCED = 410;
export const WIDGET_HEIGHT_GENERATE_IMAGE_ADVANCED = 710;

export default {
    API_KEY_NAME,
    WIDGET_WIDTH,
    WIDGET_HEIGHT_WITH_KEY,
    WIDGET_HEIGHT_WITHOUT_KEY,
    WIDGET_HEIGHT_ACCOUNT_PAGE,
    WIDGET_HEIGHT_GENERATE_IMAGE,
    WIDGET_HEIGHT_UPSCALE_WITH_KEY,
    WIDGET_HEIGHT_UPSCALE_WITHOUT_KEY,
    WIDGET_HEIGHT_REMOVE_BG_ADVANCED,
    WIDGET_HEIGHT_UPSCALE_ADVANCED,
    WIDGET_HEIGHT_GENERATE_IMAGE_ADVANCED
}