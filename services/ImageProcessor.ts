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

/**
 * Creates or finds the Picsart container and adds generated images with their prompt
 */
const addGeneratedImages = async (
  imageArrays: Uint8Array[],
  prompt: string
) => {
  try {
    console.log(`Processing ${imageArrays.length} images for prompt: "${prompt}"`);
    
    // Find or create Picsart container
    let pixartContainer = figma.currentPage.findOne(node => 
      node.type === "FRAME" && node.name === "Picsart"
    ) as FrameNode;

    if (!pixartContainer) {
      pixartContainer = figma.createFrame();
      pixartContainer.name = "Picsart";
      pixartContainer.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
      pixartContainer.layoutMode = "VERTICAL";
      pixartContainer.primaryAxisSizingMode = "FIXED"; // Fixed height, not hug
      pixartContainer.counterAxisSizingMode = "FIXED"; // Fixed width, not hug
      pixartContainer.paddingTop = 24;
      pixartContainer.paddingBottom = 24;
      pixartContainer.paddingLeft = 24;
      pixartContainer.paddingRight = 24;
      pixartContainer.itemSpacing = 16;
      pixartContainer.cornerRadius = 8;
      // Set initial size that will be updated below
      pixartContainer.resize(2200, 1200);
    }

    // Check if a generation with the same prompt already exists
    let existingGenerationGroup: FrameNode | null = null;
    let existingImagesFrame: FrameNode | null = null;

    for (let i = 0; i < pixartContainer.children.length; i++) {
      const child = pixartContainer.children[i];
      if (child.type === "FRAME") {
        // Check if this generation group has the same prompt
        const promptTextNode = child.children.find(c => c.type === "TEXT") as TextNode;
        if (promptTextNode && promptTextNode.characters === prompt) {
          existingGenerationGroup = child as FrameNode;
          // Find the images frame within this generation
          existingImagesFrame = child.children.find(c => 
            c.type === "FRAME" && c.name === "Generated Images"
          ) as FrameNode;
          console.log(`Found existing generation for prompt: "${prompt}"`);
          break;
        }
      }
    }

    let imagesFrame: FrameNode;
    let generationGroup: FrameNode;

    if (existingGenerationGroup && existingImagesFrame) {
      // Add images horizontally to existing generation
      console.log("Adding images horizontally to existing generation");
      imagesFrame = existingImagesFrame;
      generationGroup = existingGenerationGroup;
    } else {
      // Create new generation group vertically
      console.log("Creating new vertical generation group");
      
      generationGroup = figma.createFrame();
      generationGroup.name = `Generation: ${prompt.substring(0, 30)}...`;
      generationGroup.layoutMode = "VERTICAL";
      generationGroup.primaryAxisSizingMode = "AUTO"; // Generation group can hug its content
      generationGroup.counterAxisSizingMode = "AUTO";
      generationGroup.fills = [];
      generationGroup.itemSpacing = 12;

      // Create prompt label
      const promptText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      promptText.fontName = { family: "Inter", style: "Medium" };
      promptText.fontSize = 14;
      promptText.characters = prompt;
      promptText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];

      // Create horizontal frame for images
      imagesFrame = figma.createFrame();
      imagesFrame.name = "Generated Images";
      imagesFrame.layoutMode = "HORIZONTAL";
      imagesFrame.primaryAxisSizingMode = "AUTO"; // Width hugs image content
      imagesFrame.counterAxisSizingMode = "AUTO"; // Height hugs image content
      imagesFrame.fills = [];
      imagesFrame.itemSpacing = 12;

      // Add components to generation group
      generationGroup.appendChild(promptText);
      generationGroup.appendChild(imagesFrame);

      // Add generation group to Picsart container
      pixartContainer.appendChild(generationGroup);
    }

    // Create image nodes and add them to the images frame
    for (let i = 0; i < imageArrays.length; i++) {
      console.log(`Processing image ${i + 1} of ${imageArrays.length}`);
      const imageData = imageArrays[i];
      const figmaImage = figma.createImage(imageData);
      
      const imageNode = figma.createRectangle();
      // Count existing images to number them correctly
      const existingImageCount = imagesFrame.children.length;
      imageNode.name = `Generated Image ${existingImageCount + i + 1}`;
      
      // Get the actual image size from the Figma image
      const { width: imgWidth, height: imgHeight } = await figmaImage.getSizeAsync();
      console.log(`Image ${existingImageCount + i + 1} original size: ${imgWidth}x${imgHeight}`);
      
      // Use original image dimensions
      imageNode.resize(imgWidth, imgHeight);
      console.log(`Image ${existingImageCount + i + 1} display size: ${imgWidth}x${imgHeight} (original size)`);
      
      const imageFill: ImagePaint = {
        type: "IMAGE",
        imageHash: figmaImage.hash,
        scaleMode: "FILL",
      };
      
      imageNode.fills = [imageFill];
      imageNode.cornerRadius = 8;
      
      imagesFrame.appendChild(imageNode);
    }

    // Always recalculate and resize container to fit ALL content
    // Wait for layout to update after adding new content
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Calculate required container size based on ALL current content
    // Use minimum dimensions based on typical image sizes (1024px or 2048px)
    let maxWidth = 1024 + 48; // At least one image width + padding
    let totalHeight = pixartContainer.paddingTop + pixartContainer.paddingBottom;
    
    // Go through all children to calculate total required space
    for (let i = 0; i < pixartContainer.children.length; i++) {
      const child = pixartContainer.children[i];
      if (child.type === "FRAME") {
        // Add this generation's width requirement (minimum 2048 + padding for 2 images)
        const childRequiredWidth = Math.max(2048 + 48, child.width + pixartContainer.paddingLeft + pixartContainer.paddingRight);
        maxWidth = Math.max(maxWidth, childRequiredWidth);
        
        // Add this generation's height (minimum 1024 + text height)
        const childHeight = Math.max(1024 + 50, child.height); // 50px for text + spacing
        totalHeight += childHeight;
        
        if (i > 0) totalHeight += pixartContainer.itemSpacing; // spacing between generations
      }
    }
    
    console.log(`Container now has ${pixartContainer.children.length} generations`);
    console.log(`Calculated container size needed: ${maxWidth}x${totalHeight}`);
    
    // Ensure minimum dimensions for proper image display
    maxWidth = Math.max(maxWidth, 2200); // Minimum for 2 × 1024px images + spacing + padding
    totalHeight = Math.max(totalHeight, 1200); // Minimum for 1024px images + text + padding
    
    // Resize container to fit all content
    pixartContainer.resizeWithoutConstraints(maxWidth, totalHeight);
    
    console.log(`Container resized to: ${pixartContainer.width}x${pixartContainer.height}`);

    // Center view on the new content
    figma.viewport.scrollAndZoomIntoView([generationGroup]);

    console.log(`Successfully added ${imageArrays.length} images to Picsart container`);
    return "Images added to Picsart container successfully!";
  } catch (error) {
    console.error("Error adding generated images:", error);
    return "Error adding images to Picsart container";
  }
};

const actions = { processImage, setFetchedImage, addGeneratedImages };

export default actions;
