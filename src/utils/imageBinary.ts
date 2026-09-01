// Renamed from imageprocessor.ts. Two modules named ImageProcessor existed, one
// per runtime context (services/ImageProcessor.ts in the sandbox, this one in the
// UI iframe), differing only by case with forceConsistentCasingInFileNames on.
// This module has exactly one job, so it is named for that job instead.
//
// The `isImageSelected()` helper that used to live here was deleted: nothing
// imported it, it called figma.currentPage from inside the UI bundle where figma
// does not exist, and its accepted node types (it allowed FRAME) contradicted the
// sandbox's own selection check.
/**
 * The real format of the bytes, read from their magic number.
 *
 * These bytes come from `image.getBytesAsync()`, which returns the image fill
 * exactly as it was encoded — so a layer whose background was removed is a
 * transparent PNG. Every upload used to be declared `image/jpeg` regardless,
 * which is a format with no alpha channel: the label contradicted the bytes on
 * exactly the images whose transparency matters most.
 */
export const imageTypeOf = (bytes: Uint8Array): { mime: string; extension: string } => {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", extension: "png" };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mime: "image/gif", extension: "gif" };
  }
  // RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return { mime: "image/jpeg", extension: "jpg" };
};

/**
 * Prepare a Figma layer's bytes for upload as an edit source.
 *
 * Two limits meet here, and getting either wrong costs the user a paid call:
 *
 * - **Figma's `createImage` refuses anything over 4096px** in either dimension. Edit
 *   output tracks the *source* resolution, so a 6000×4000 photo — routine in a real
 *   Figma file — produces a result that cannot be placed after it has been paid for.
 *   The source is downscaled to fit instead.
 * - **The API's own floor is 16×16.** Below that it answers 400, so it is checked here
 *   rather than discovered by spending a request.
 *
 * **An image already inside the ceiling passes through untouched.** That matters more
 * than it looks: a canvas re-encode of a PNG as JPEG flattens alpha to black, and the
 * single most common edit source in this plugin is a layer whose background was
 * already removed. When a re-encode is genuinely needed, the output type is taken from
 * the source's own magic number rather than assumed.
 *
 * One decode does all of it. The previous helper decoded the full image purely to
 * validate it, discarded the result, and returned the original blob — so adding a
 * downscale on top would have meant two decodes of up to 24 megapixels in an iframe.
 */
export interface PreparedSource {
  blob: Blob;
  extension: string;
  width: number;
  height: number;
  /** True when the image was too large and had to be scaled down to fit. */
  downscaled: boolean;
}

export const prepareEditSource = async (
  bytes: Uint8Array,
  maxDimension: number,
  minDimension: number
): Promise<PreparedSource | { error: "too-small" | "undecodable" }> => {
  const type = imageTypeOf(bytes);
  const blob = new Blob([bytes as BlobPart], { type: type.mime });

  let bitmap: ImageBitmap;
  try {
    // One decode, which validates and measures at the same time.
    bitmap = await createImageBitmap(blob);
  } catch (error) {
    console.error("Could not decode the selected layer's image:", error);
    return { error: "undecodable" };
  }

  const { width, height } = bitmap;

  if (width < minDimension || height < minDimension) {
    bitmap.close();
    return { error: "too-small" };
  }

  const longestSide = Math.max(width, height);
  if (longestSide <= maxDimension) {
    bitmap.close();
    // Untouched. No canvas, no re-encode, no alpha loss.
    return { blob, extension: type.extension, width, height, downscaled: false };
  }

  const scale = maxDimension / longestSide;
  const targetWidth = Math.max(Math.round(width * scale), 1);
  const targetHeight = Math.max(Math.round(height * scale), 1);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    console.error("No 2d canvas context available to downscale the source image.");
    return { error: "undecodable" };
  }
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  // The source's own format, not a hardcoded one. A PNG stays a PNG so a transparent
  // layer does not come back with a black background. GIF and WEBP sources re-encode
  // as PNG, which is the lossless option that keeps alpha.
  const encodeMime = type.mime === "image/jpeg" ? "image/jpeg" : "image/png";
  const encodeExtension = encodeMime === "image/jpeg" ? "jpg" : "png";

  const scaled = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, encodeMime)
  );
  if (!scaled) {
    console.error("Canvas produced no blob while downscaling the source image.");
    return { error: "undecodable" };
  }

  return {
    blob: scaled,
    extension: encodeExtension,
    width: targetWidth,
    height: targetHeight,
    downscaled: true,
  };
};

export const getImageBinary = (bytes: ArrayBuffer): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(bytes);
      const blob = new Blob([data], { type: imageTypeOf(data).mime });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Invalid image"));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
};

export default getImageBinary;
