import { describe, expect, it } from "vitest";
import { imageTypeOf } from "@utils/imageBinary";

// getImageBinary itself needs a real image decode (`new Image()` + a blob URL),
// which no test environment here provides. The format sniffing is the part that
// decides what the upload claims to be, and it is pure.
describe("imageTypeOf", () => {
  it("recognises a PNG, the format that carries the transparency", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(imageTypeOf(png)).toEqual({ mime: "image/png", extension: "png" });
  });

  it("recognises a GIF", () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(imageTypeOf(gif).mime).toBe("image/gif");
  });

  it("recognises a WEBP by its RIFF container", () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(imageTypeOf(webp).mime).toBe("image/webp");
  });

  it("treats a JPEG as a JPEG", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(imageTypeOf(jpeg)).toEqual({ mime: "image/jpeg", extension: "jpg" });
  });

  it("falls back to JPEG for bytes it cannot place", () => {
    expect(imageTypeOf(new Uint8Array([1, 2, 3])).mime).toBe("image/jpeg");
  });

  it("does not read past the end of a short buffer", () => {
    expect(() => imageTypeOf(new Uint8Array([0x52, 0x49]))).not.toThrow();
  });
});
