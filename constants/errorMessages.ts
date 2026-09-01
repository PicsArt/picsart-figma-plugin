export const SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR = "Selected node does not support 'fills' or 'resize'."
export const NO_NODE_SELECTED_ERR = "No node selected"
export const KEY_MISSING_ERR = "Set API Key first."
export const KEY_WRONG_ERR   = "API key is wrong"
export const NODE_NOT_SELECTED_ERR = "Select a single node." 
export const NO_IMAGE_IN_NODE_ERR = "No image bytes were returned or the selected node doesn't contain an image."
export const TOKEN_ERR = "token_error"
export const UNKNOWN_COMMAND_ERR = "Unknown Command"
export const REMOVE_BG_FAILED_ERR = "Couldn't remove the background. Please try again."
export const UPSCALE_FAILED_ERR = "Couldn't enhance the image. Please try again."
export const GENERATE_IMAGE_FAILED_ERR = "Couldn't generate the image. Please try again."
export const REMOVE_BG_REJECTED_ERR =
  "This image couldn't be processed with these settings. Try different settings or another image."
export const UPSCALE_REJECTED_ERR =
  "This image couldn't be enhanced with these settings. Try a lower enhance factor or another image."
export const GENERATE_IMAGE_REJECTED_ERR =
  "This request was refused. Adjust the prompt or the settings, then run it again."
export const SOURCE_LAYER_GONE_ERR =
  "The layer this was made from no longer exists, so the result could not be placed."
export const SOURCE_LAYER_LOCKED_ERR =
  "The layer this was made from is locked. Unlock it and run this again."
export const NODE_CANNOT_HOLD_IMAGE_ERR =
  "That layer cannot hold an image. Select an image, a shape with an image fill, or a frame containing one."
export const RESULT_DOWNLOAD_FAILED_ERR =
  "The result was created but couldn't be downloaded. Check your connection and run this again."
export const RESULT_HOST_BLOCKED_ERR =
  "The result was created but is hosted somewhere this plugin is not allowed to load from. Please report this."
export const BALANCE_UNAVAILABLE_ERR =
  "Couldn't read your credit balance. Check your connection and try again."
export const SOURCE_TOO_SMALL_ERR =
  "That layer is too small to edit — it needs to be at least 16 by 16 pixels."
export const UNSUPPORTED_MEDIA_ERR =
  "That image format isn't supported. Use a PNG or JPG layer."
export const EDIT_IMAGE_FAILED_ERR = "Couldn't edit the image. Please try again."
export const EDIT_NOTHING_PLACED_ERR =
  "The edit finished but none of the results could be placed on the canvas."
export const SOURCE_LAYER_GONE_PLACED_ERR =
  "The layer this was made from no longer exists, so the results were added at the centre of your view."
export const EDIT_IMAGE_REJECTED_ERR =
  "This edit was refused. Adjust the instruction or the settings, then run it again."

export default {
    SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR,
    NO_NODE_SELECTED_ERR,
    TOKEN_ERR,
    KEY_MISSING_ERR,
    KEY_WRONG_ERR,
    NODE_NOT_SELECTED_ERR,
    NO_IMAGE_IN_NODE_ERR,
    UNKNOWN_COMMAND_ERR,
    REMOVE_BG_FAILED_ERR,
    UPSCALE_FAILED_ERR,
    GENERATE_IMAGE_FAILED_ERR,
    REMOVE_BG_REJECTED_ERR,
    UPSCALE_REJECTED_ERR,
    GENERATE_IMAGE_REJECTED_ERR,
    SOURCE_LAYER_GONE_ERR,
    SOURCE_LAYER_LOCKED_ERR,
    NODE_CANNOT_HOLD_IMAGE_ERR,
    RESULT_DOWNLOAD_FAILED_ERR,
    RESULT_HOST_BLOCKED_ERR,
    BALANCE_UNAVAILABLE_ERR,
    SOURCE_TOO_SMALL_ERR,
    UNSUPPORTED_MEDIA_ERR,
    EDIT_IMAGE_FAILED_ERR,
    EDIT_IMAGE_REJECTED_ERR,
    EDIT_NOTHING_PLACED_ERR,
    SOURCE_LAYER_GONE_PLACED_ERR
}