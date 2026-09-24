export const SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR = "Selected node does not support 'fills' or 'resize'."
export const NO_NODE_SELECTED_ERR = "No node selected"
export const KEY_WRONG_ERR =
  "That API key was rejected. Check the whole key was pasted, or mint a new one in the Picsart console."

export const SESSION_EXPIRED_ERR =
  "Your Picsart sign-in expired. Sign in again to carry on — nothing was charged."
export const SESSION_SCOPE_ERR =
  "This Picsart sign-in didn't grant the permission the plugin needs (workflows.execute). Sign out and sign in again, or use an API key."
export const BEARER_REJECTED_ERR =
  "Picsart didn't accept your account sign-in for this request. Use an API key for now, and please report this."
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

export const SIGN_IN_DECLINED_ERR =
  "Picsart declined the sign-in. Try again, or use an API key instead."
export const SIGN_IN_CANCELLED_MSG =
  "Sign-in cancelled. Nothing was changed."
export const SIGN_IN_TIMED_OUT_ERR =
  "The sign-in wasn't completed in time. Start it again, or use an API key instead."
export const SIGN_IN_CODE_UNREADABLE_ERR =
  "That doesn't contain an authorization code. Paste the whole address from your browser, or just the code itself."
export const SIGN_IN_STATE_MISMATCH_ERR =
  "This sign-in couldn't be verified, so it wasn't accepted. Start a new sign-in."
export const SIGN_IN_NO_SESSION_ERR =
  "This sign-in has already ended. Start a new one."
export const SIGN_IN_UNREACHABLE_ERR =
  "Couldn't reach Picsart to finish signing in. Check your connection and try again."
export const SIGN_IN_BLOCKED_ERR =
  "Picsart's sign-in service wouldn't answer the plugin — this needs fixing on Picsart's side, not by you. Use an API key for now, and please report it."
export const SIGN_IN_FAILED_ERR =
  "Couldn't finish signing in. Try again, or use an API key instead."
export const SIGN_IN_NO_RANDOM_ERR =
  "Sign-in isn't available in this version of the plugin — it can't generate the security code it needs. Use an API key for now, and please tell us on the Support tab."
export const SIGN_IN_NOT_REMEMBERED_ERR =
  "You're signed in, but it couldn't be saved — you'll need to sign in again next time you open the plugin."
export const SESSION_ENDED_ERR =
  "Your Picsart session has ended. Sign in again to carry on."
export const SIGNED_OUT_USING_KEY_MSG =
  "Signed out of Picsart. You're now using your API key, so credits come from that key's balance."
export const SIGNED_OUT_MSG = "Signed out of Picsart."

export default {
    SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR,
    NO_NODE_SELECTED_ERR,
    TOKEN_ERR,
    KEY_WRONG_ERR,
    SESSION_EXPIRED_ERR,
    SESSION_SCOPE_ERR,
    BEARER_REJECTED_ERR,
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
    SOURCE_LAYER_GONE_PLACED_ERR,
    SIGN_IN_DECLINED_ERR,
    SIGN_IN_CANCELLED_MSG,
    SIGN_IN_TIMED_OUT_ERR,
    SIGN_IN_CODE_UNREADABLE_ERR,
    SIGN_IN_STATE_MISMATCH_ERR,
    SIGN_IN_NO_SESSION_ERR,
    SIGN_IN_UNREACHABLE_ERR,
    SIGN_IN_BLOCKED_ERR,
    SIGN_IN_FAILED_ERR,
    SIGN_IN_NOT_REMEMBERED_ERR,
    SESSION_ENDED_ERR,
    SIGNED_OUT_USING_KEY_MSG,
    SIGNED_OUT_MSG
}