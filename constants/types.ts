// The selection channel, split three ways. There used to be one constant,
// TYPE_IMAGEBYTES, carrying two opposite meanings depending on direction:
// sandbox->UI it meant "here are the bytes of the selected layer", UI->sandbox it
// meant "here is a finished result, write it to the canvas". A successful
// background removal therefore overwrote the selection state the banner reads,
// and the same state was both the input and the output of every paid call.
//
//   TYPE_IMAGE_SELECTED      sandbox -> UI   a SelectionDescriptor, or null
//   TYPE_REQUEST_IMAGE_BYTES UI -> sandbox   "read bytes for this nodeId"
//   TYPE_IMAGE_BYTES_RESULT  sandbox -> UI   the reply to the above
//   TYPE_APPLY_IMAGE         UI -> sandbox   "write these bytes to this nodeId"
//   TYPE_PLACEMENT_DONE      sandbox -> UI   "the write finished" — see below
export const TYPE_IMAGE_SELECTED = "image-selected" as const;
export const TYPE_REQUEST_IMAGE_BYTES = "request-image-bytes" as const;
export const TYPE_IMAGE_BYTES_RESULT = "image-bytes-result" as const;
export const TYPE_APPLY_IMAGE = "apply-image" as const;
/**
 * Sandbox -> UI, correlated by `placementId`: the canvas write has finished.
 *
 * Without this the UI could only fire-and-forget. `figma.ui.onmessage` is a plain
 * callback and Figma does not await the promise a handler returns, so a UI that
 * posted TYPE_APPLY_IMAGE and TYPE_CLOSE_PLUGIN back to back raced them: the apply
 * suspended at `await getNodeByIdAsync` and the close ran `figma.closePlugin()`
 * before it resumed. "Remove Background Instantly" charged the user and left the
 * layer untouched, with no error. Placement work is now acknowledged, and the
 * flows that depend on it wait for the ack rather than for luck.
 */
export const TYPE_PLACEMENT_DONE = "placement-done" as const;
export const TYPE_ACTION = "action" as const;
export const TYPE_CREDENTIAL = "credential" as const;
export const TYPE_AUTH_STATE = "auth-state" as const;
export const TYPE_SIGN_IN = "sign-in" as const;
export const TYPE_AUTH_RESPONSE = "auth-response" as const;
export const TYPE_CANCEL_SIGN_IN = "cancel-sign-in" as const;
export const TYPE_SIGN_OUT = "sign-out" as const;
export const TYPE_REFRESH_CREDENTIAL = "refresh-credential" as const;
export const TYPE_NOTIFY = "notify" as const;
export const TYPE_TAB = "tab" as const;
export const TYPE_SET_KEY = "setkey" as const
export const TYPE_REMOVE_KEY = "remove-key" as const;
export const TYPE_VALIDATE_KEY = "validate-key" as const;
export const TYPE_CLOSE_PLUGIN = "validateclose-plugin" as const;
export const TYPE_GENERATED_IMAGES = "generated-images" as const;
/**
 * UI -> sandbox: place edit-mode candidates beside the layer they came from.
 *
 * Deliberately not TYPE_GENERATED_IMAGES with an extra field. That channel means
 * "add these to the shared gallery frame", which is a different destination, a
 * different layout and a different naming scheme. Overloading it is how
 * TYPE_IMAGEBYTES came to mean two opposite things.
 */
export const TYPE_PLACE_EDITED_IMAGES = "place-edited-images" as const;
export const TYPE_SWITCH_TAB = "switch-tab" as const;
export const TYPE_SET_BALANCE = "set-balance" as const;
export const TYPE_GET_BALANCE = "get-balance" as const;
export const TYPE_RESIZE = "resize" as const;
// UI -> sandbox, sent once as soon as the React app has mounted. Replaces guessing
// how long the iframe needs before postMessage will be heard.
export const TYPE_UI_READY = "ui-ready" as const;

export const TYPE_REQUEST_RANDOM = "request-random" as const;
export const TYPE_RANDOM_RESULT = "random-result" as const;

export const TYPE_LOAD_EXCHANGE_PAGE = "load-exchange-page" as const;
export const TYPE_EXCHANGE_PAGE_READY = "exchange-page-ready" as const;
export const TYPE_EXCHANGE_REQUEST = "exchange-request" as const;
export const TYPE_EXCHANGE_RESULT = "exchange-result" as const;

const TYPES = {
  TYPE_CREDENTIAL,
  TYPE_AUTH_STATE,
  TYPE_SIGN_IN,
  TYPE_AUTH_RESPONSE,
  TYPE_CANCEL_SIGN_IN,
  TYPE_SIGN_OUT,
  TYPE_REFRESH_CREDENTIAL,
  TYPE_ACTION,
  TYPE_NOTIFY,
  TYPE_IMAGE_SELECTED,
  TYPE_REQUEST_IMAGE_BYTES,
  TYPE_IMAGE_BYTES_RESULT,
  TYPE_APPLY_IMAGE,
  TYPE_PLACEMENT_DONE,
  TYPE_TAB,
  TYPE_SET_KEY,
  TYPE_REMOVE_KEY,
  TYPE_VALIDATE_KEY,
  TYPE_CLOSE_PLUGIN,
  TYPE_GENERATED_IMAGES,
  TYPE_PLACE_EDITED_IMAGES,
  TYPE_SWITCH_TAB,
  TYPE_SET_BALANCE,
  TYPE_GET_BALANCE,
  TYPE_RESIZE,
  TYPE_UI_READY,
  TYPE_REQUEST_RANDOM,
  TYPE_RANDOM_RESULT,
  TYPE_LOAD_EXCHANGE_PAGE,
  TYPE_EXCHANGE_PAGE_READY,
  TYPE_EXCHANGE_REQUEST,
  TYPE_EXCHANGE_RESULT,
};

export default TYPES;