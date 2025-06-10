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
export const addGeneratedImages = async (images: Uint8Array[], prompt: string): Promise<string> => {
  try {
    console.log(`Adding ${images.length} generated images for prompt: "${prompt}"`);
    
    // Find or create the main Picsart container
    let picsartContainer = figma.currentPage.findOne(node =>
      node.type === "FRAME" && node.name === "Picsart"
    ) as FrameNode;

    if (!picsartContainer) {
      picsartContainer = figma.createFrame();
      picsartContainer.name = "Picsart";
      picsartContainer.fills = [{ type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } }];
      picsartContainer.layoutMode = "VERTICAL";
      picsartContainer.primaryAxisSizingMode = "FIXED"; // Fixed height, not hug
      picsartContainer.counterAxisSizingMode = "FIXED"; // Fixed width, not hug
      picsartContainer.paddingTop = 24;
      picsartContainer.paddingBottom = 24;
      picsartContainer.paddingLeft = 24;
      picsartContainer.paddingRight = 24;
      picsartContainer.itemSpacing = 16;
      picsartContainer.cornerRadius = 8;
      
      picsartContainer.resize(2200, 1200);
    }

    // Check if this prompt already exists and find its generation number
    let existingGeneration: FrameNode | null = null;
    let maxImageNumber = 0;
    
    for (let i = 0; i < picsartContainer.children.length; i++) {
      const child = picsartContainer.children[i];
      if (child.type === "FRAME" && child.name.startsWith("Generation:")) {
        const generationFrame = child as FrameNode;
        
        // Check if any text node contains this prompt
        const textNodes = generationFrame.findAll(node => node.type === "TEXT") as TextNode[];
        for (const textNode of textNodes) {
          if (typeof textNode.characters === 'string' && textNode.characters.includes(prompt)) {
            console.log(`Found existing generation for prompt: "${prompt}"`);
            existingGeneration = generationFrame;
            
            // Find the images frame within this generation
            const imagesFrame = generationFrame.findOne(node => 
              node.type === "FRAME" && node.name === "Generated Images"
            ) as FrameNode;
            
            if (imagesFrame) {
              // Count existing images to determine next number
              const existingImages = imagesFrame.findAll(node => 
                node.type === "RECTANGLE" && node.name.startsWith("Image ")
              );
              maxImageNumber = existingImages.length;
              console.log(`Found ${maxImageNumber} existing images in this generation`);
            }
            break;
          }
        }
        if (existingGeneration) break;
      }
    }

    let imagesFrame: FrameNode;
    
    if (existingGeneration) {
      // Find the existing images frame
      imagesFrame = existingGeneration.findOne(node => 
        node.type === "FRAME" && node.name === "Generated Images"
      ) as FrameNode;
      
      console.log(`Adding to existing generation. Current images: ${maxImageNumber}`);
    } else {
      // Create new generation group
      const generationGroup = figma.createFrame();
      generationGroup.name = `Generation: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`;
      generationGroup.layoutMode = "VERTICAL";
      generationGroup.primaryAxisSizingMode = "AUTO"; // Hug content
      generationGroup.counterAxisSizingMode = "FIXED"; // Fixed width
      generationGroup.paddingTop = 16;
      generationGroup.paddingBottom = 16;
      generationGroup.paddingLeft = 16;
      generationGroup.paddingRight = 16;
      generationGroup.itemSpacing = 12;
      generationGroup.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      generationGroup.cornerRadius = 8;
      generationGroup.resize(2048, 200); // Start with reasonable size

      // Create prompt text
      const promptText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      promptText.characters = prompt;
      promptText.fontSize = 14;
      promptText.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
      promptText.resize(2000, promptText.height);
      
      // Create images container
      imagesFrame = figma.createFrame();
      imagesFrame.name = "Generated Images";
      imagesFrame.layoutMode = "HORIZONTAL";
      imagesFrame.primaryAxisSizingMode = "AUTO"; // Auto size horizontally
      imagesFrame.counterAxisSizingMode = "AUTO"; // Auto size vertically  
      imagesFrame.itemSpacing = 12;
      imagesFrame.fills = [];

      generationGroup.appendChild(promptText);
      generationGroup.appendChild(imagesFrame);
      picsartContainer.appendChild(generationGroup);
      
      console.log(`Created new generation for prompt: "${prompt}"`);
    }

    // Add all images to the images frame
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      const imageNumber = maxImageNumber + i + 1;
      
      try {
        console.log(`Creating image ${imageNumber}, size: ${imageData.byteLength} bytes`);
        
        const imageNode = figma.createRectangle();
        imageNode.name = `Image ${imageNumber}`;
        
        // Create image hash for fill
        const imageHash = figma.createImage(imageData);
        
        // Set image fill
        imageNode.fills = [{
          type: "IMAGE",
          imageHash: imageHash.hash,
          scaleMode: "FILL"
        }];
        
        // Set size to original image dimensions (1024x1024 for our generated images)
        imageNode.resize(1024, 1024);
        
        imagesFrame.appendChild(imageNode);
        console.log(`Successfully added Image ${imageNumber}`);
        
      } catch (error) {
        console.error(`Error adding image ${imageNumber}:`, error);
      }
    }

    // Calculate and update container size to fit all content
    let totalHeight = picsartContainer.paddingTop + picsartContainer.paddingBottom;
    let maxWidth = 2200; // Minimum width

    for (let i = 0; i < picsartContainer.children.length; i++) {
      const child = picsartContainer.children[i];
      totalHeight += child.height;
      const childRequiredWidth = Math.max(2048 + 48, child.width + picsartContainer.paddingLeft + picsartContainer.paddingRight);
      if (childRequiredWidth > maxWidth) {
        maxWidth = childRequiredWidth;
      }
      
      // Add spacing between generations (but not after the last one)
      if (i > 0) totalHeight += picsartContainer.itemSpacing; // spacing between generations
    }

    console.log(`Container now has ${picsartContainer.children.length} generations`);
    console.log(`Calculated total height: ${totalHeight}, max width: ${maxWidth}`);

    // Resize container to fit all content
    picsartContainer.resizeWithoutConstraints(maxWidth, totalHeight);
    
    console.log(`Container resized to: ${picsartContainer.width}x${picsartContainer.height}`);

    // Center view on the container
    figma.viewport.scrollAndZoomIntoView([picsartContainer]);

    return `Successfully added ${images.length} generated image${images.length > 1 ? 's' : ''} to Figma canvas`;

  } catch (error) {
    console.error("Error in addGeneratedImages:", error);
    return `Failed to add generated images: ${error}`;
  }
};

const actions = { processImage, setFetchedImage, addGeneratedImages };

export default actions;
