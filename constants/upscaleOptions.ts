// Advanced-settings option lists for the Upscale (enhance) feature.

// Output image format. The API also offers WEBP, but figma.createImage() only
// decodes PNG/JPG/GIF, so a WEBP result could not be placed on the canvas.
//
// PNG is the default even though the API's own default is JPG: the input is a
// Figma layer, and a layer whose background was already removed is transparent.
// JPG has no alpha channel, so it flattened that transparency to black and the
// result came back unusable — with the user charged for it. PNG costs file size
// and nothing else.
export const UPSCALE_FORMAT_OPTIONS = ["PNG", "JPG"] as const;
export const DEFAULT_UPSCALE_FORMAT = "PNG" as const;
