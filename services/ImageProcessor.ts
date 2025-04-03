import {
  BACKGROUND_SUCC_REMOVED,
  NO_NODE_SELECTED_ERR,
  SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR,
  TYPE_IMAGEBYTES,
  UPSCALE_SUCC_COMPLETED,
} from "../constants/index";

export const getImageSelectionStatus = async () => {
  return await processImage(figma);
};

export const sendImageSelectionStatus = async () => {
  figma.ui.postMessage({
    type: TYPE_IMAGEBYTES,
    payload: await processImage(figma),
  });
};

/**
 * Processes the selected node to extract the image bytes if it has an image fill.
 * This function checks the selected node, finds the image fill, and retrieves the image bytes for further processing.
 */
const processImage = async (
  figma: PluginAPI
): Promise<Uint8Array | undefined> => {
  const selectedNodes = figma.currentPage.selection;

  if (selectedNodes.length === 0) {
    return;
  }
  const selectedNode = selectedNodes[0];

  let types = ["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "TEXT"];
  if (types.indexOf(selectedNode.type) > -1) {
    if ("fills" in selectedNode) {
      const fills = selectedNode.fills as ReadonlyArray<Paint>;

      const imageFill = fills.find(
        (fill): fill is ImagePaint => fill.type === "IMAGE"
      );

      if (imageFill && imageFill.imageHash) {
        const image = figma.getImageByHash(imageFill.imageHash);
        const imageBytes = await image?.getBytesAsync();
        return imageBytes;
      }
    }
  }
};

/**
 * Sets the fetched image as a fill on the selected node and resizes the node if a scaleFactor is provided.
 * This function takes an image in Uint8Array format and applies it to the selected node, optionally resizing the node.
 */
const setFetchedImage = async (
  uint8Array: Uint8Array,
  scaleFactor: number | undefined
) =>  {
  const selectedNodes = figma.currentPage.selection;

  if (selectedNodes.length === 0) {
    figma.notify(NO_NODE_SELECTED_ERR);
    return "";
  }

  const selectedNode = selectedNodes[0];

  if ("fills" in selectedNode && "resize" in selectedNode) {
    if (typeof scaleFactor == "number" && scaleFactor > 1) {
      selectedNode.resize(
        selectedNode.width * scaleFactor,
        selectedNode.height * scaleFactor
      );
    }

    const newImage = figma.createImage(uint8Array);

    const imageFill: ImagePaint = {
      type: "IMAGE",
      imageHash: newImage.hash,
      scaleMode: "FILL",
    };

    (selectedNode as GeometryMixin).fills = [imageFill];

    if (scaleFactor) {
      return UPSCALE_SUCC_COMPLETED;
    } else {
      return BACKGROUND_SUCC_REMOVED;
    }
  } else {
    return SELCTED_NODE_NOFILSS_OR_RESIZE_SUPPORT_ERR;
  }
};

const actions = { processImage, setFetchedImage };

export default actions;
