export const TYPE_IMAGEBYTES = "image-bytes" as const;
export const TYPE_COMMAND = "command" as const;
export const TYPE_ACTION = "action" as const;
export const TYPE_ACCOUNT = "acount" as const;
export const TYPE_KEY = "key" as const;
export const TYPE_IMAGE_SELECTED = "image-selected" as const;
export const TYPE_NOTIFY = "notify" as const;
export const TYPE_TAB = "tab" as const;
export const TYPE_SET_KEY = "setkey" as const;
export const TYPE_INSTANTLY_REMOVE = "instantly remove background" as const;
export const TYPE_VALIDATE_KEY = "validate-key" as const;
export const TYPE_CLOSE_PLUGIN = "validateclose-plugin" as const;
export const TYPE_TEXT_TO_IMAGE_TAB = "text-to-image-tab" as const;
export const TYPE_GENERATED_IMAGES = "generated-images" as const;

const TYPES = {
  TYPE_IMAGEBYTES,
  TYPE_COMMAND,
  TYPE_KEY,
  TYPE_ACTION,
  TYPE_NOTIFY,
  TYPE_IMAGE_SELECTED,
  TYPE_TAB,
  TYPE_ACCOUNT,
  TYPE_INSTANTLY_REMOVE,
  TYPE_VALIDATE_KEY,
  TYPE_CLOSE_PLUGIN,
  TYPE_TEXT_TO_IMAGE_TAB,
  TYPE_GENERATED_IMAGES
};

export default TYPES;