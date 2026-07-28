import { SelectOption } from "./generateImageOptions";

// Advanced-settings option lists for the Remove Background feature.
// Values are what the Picsart removebg API expects; labels are shown in the UI.

// cutout returns the subject as a sticker; mask returns a black/white matte.
export const REMOVEBG_OUTPUT_TYPE_CUTOUT = "cutout" as const;
export const REMOVEBG_OUTPUT_TYPE_OPTIONS: SelectOption[] = [
  { label: "Cutout", value: REMOVEBG_OUTPUT_TYPE_CUTOUT },
  { label: "Mask", value: "mask" },
];
export const DEFAULT_REMOVEBG_OUTPUT_TYPE = REMOVEBG_OUTPUT_TYPE_CUTOUT;

// Output image format. The API also offers WEBP, but figma.createImage() only
// decodes PNG/JPG/GIF, so a WEBP result could not be placed on the canvas.
// PNG is the API default and the only format that keeps the cutout transparent.
export const REMOVEBG_FORMAT_OPTIONS = ["PNG", "JPG"] as const;
export const DEFAULT_REMOVEBG_FORMAT = "PNG" as const;

// How the subject is scaled onto the background.
export const REMOVEBG_SCALE_OPTIONS: SelectOption[] = [
  { label: "Fit", value: "fit" },
  { label: "Fill", value: "fill" },
];
export const DEFAULT_REMOVEBG_SCALE = "fit" as const;

// Segmentation models the API accepts. "" sends no model field, leaving the
// choice to the API — the behaviour the plugin had before advanced settings.
export const REMOVEBG_MODEL_OPTIONS: SelectOption[] = [
  { label: "Default", value: "" },
  { label: "SOD 8.2", value: "urn:air:picsart:model:picsart:sod@8.2" },
  { label: "SOD 10", value: "urn:air:picsart:model:picsart:sod@10" },
  { label: "SOD 10.1", value: "urn:air:picsart:model:picsart:sod@10.1" },
  { label: "SOD 11", value: "urn:air:picsart:model:picsart:sod@11" },
];
export const DEFAULT_REMOVEBG_MODEL = "" as const;

// Drop-shadow configuration. "disabled" renders no shadow; "custom" uses the
// shadow_offset_x / shadow_offset_y values; the rest are preset directions.
export const REMOVEBG_SHADOW_DISABLED = "disabled" as const;
export const REMOVEBG_SHADOW_CUSTOM = "custom" as const;
export const REMOVEBG_SHADOW_OPTIONS: SelectOption[] = [
  { label: "Disabled", value: REMOVEBG_SHADOW_DISABLED },
  { label: "Custom", value: REMOVEBG_SHADOW_CUSTOM },
  { label: "Bottom", value: "bottom" },
  { label: "Bottom right", value: "bottom-right" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Right", value: "right" },
  { label: "Left", value: "left" },
  { label: "Top", value: "top" },
  { label: "Top right", value: "top-right" },
  { label: "Top left", value: "top-left" },
];
export const DEFAULT_REMOVEBG_SHADOW = REMOVEBG_SHADOW_DISABLED;

// Numeric defaults and ranges, matching the API.
export const DEFAULT_REMOVEBG_BG_BLUR = 0 as const;
export const DEFAULT_REMOVEBG_STROKE_SIZE = 0 as const;
export const DEFAULT_REMOVEBG_STROKE_COLOR = "FFFFFF" as const;
export const DEFAULT_REMOVEBG_STROKE_OPACITY = 100 as const;
export const DEFAULT_REMOVEBG_SHADOW_OPACITY = 20 as const;
export const DEFAULT_REMOVEBG_SHADOW_BLUR = 50 as const;
export const DEFAULT_REMOVEBG_SHADOW_OFFSET = 0 as const;
export const REMOVEBG_PERCENT_MIN = 0 as const;
export const REMOVEBG_PERCENT_MAX = 100 as const;
export const REMOVEBG_OFFSET_MIN = -100 as const;
export const REMOVEBG_OFFSET_MAX = 100 as const;
