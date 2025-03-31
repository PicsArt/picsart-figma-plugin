export const isImageSelected = (): boolean => {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return false;
  }
  const imageNodes = selection.filter(
    (node) =>
      (node.type === "RECTANGLE" ||
        node.type === "VECTOR" ||
        node.type === "ELLIPSE" ||
        node.type === "FRAME") &&
      Array.isArray(node.fills) &&
      node.fills.some((fill) => fill.type === "IMAGE")
  );
  return imageNodes.length > 0;
};

export const getImageBinary = (bytes: ArrayBuffer): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
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
