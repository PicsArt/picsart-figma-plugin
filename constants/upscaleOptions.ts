// Advanced-settings option lists for the Upscale (enhance) feature.

// Output image format. The API also offers WEBP, but figma.createImage() only
// decodes PNG/JPG/GIF, so a WEBP result could not be placed on the canvas.
// JPG is the API default; PNG keeps transparency at the cost of file size.
export const UPSCALE_FORMAT_OPTIONS = ["JPG", "PNG"] as const;
export const DEFAULT_UPSCALE_FORMAT = "JPG" as const;
