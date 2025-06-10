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

export const addGeneratedImages = async (images: Uint8Array[], prompt: string): Promise<string> => {
  try {
    console.log(`Adding ${images.length} generated images for prompt: "${prompt}"`);
    
    let picsartContainer = figma.currentPage.findOne(node =>
      node.type === "FRAME" && node.name === "Picsart"
    ) as FrameNode;

    if (!picsartContainer) {
      picsartContainer = figma.createFrame();
      picsartContainer.name = "Picsart";
      
      picsartContainer.fills = [{ type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.15 } }];
      picsartContainer.layoutMode = "VERTICAL";
      picsartContainer.primaryAxisSizingMode = "FIXED";
      picsartContainer.counterAxisSizingMode = "FIXED";
      picsartContainer.paddingTop = 24;
      picsartContainer.paddingBottom = 24;
      picsartContainer.paddingLeft = 24;
      picsartContainer.paddingRight = 24;
      picsartContainer.itemSpacing = 16;
      picsartContainer.cornerRadius = 8;
      
      picsartContainer.resize(2200, 1200);
      
      let leftmostX = 0;
      let leftmostY = 0;
      
      const allNodes = figma.currentPage.children;
      if (allNodes.length > 0) {
        let leftmostX_value = allNodes[0].x;
        
        for (const node of allNodes) {
          if (node.x < leftmostX_value) {
            leftmostX_value = node.x;
          }
        }
        
        const leftmostNodes = allNodes.filter(node => node.x === leftmostX_value);
        
        let bottomLeftmostNode = leftmostNodes[0];
        leftmostX = bottomLeftmostNode.x;
        leftmostY = bottomLeftmostNode.y;
        
        for (const node of leftmostNodes) {
          if (node.y > leftmostY) {
            leftmostX = node.x;
            leftmostY = node.y;
            bottomLeftmostNode = node;
          }
        }
        
        console.log(`Found bottom element among leftmost: "${bottomLeftmostNode.name}" at x: ${leftmostX}, y: ${leftmostY}`);
        
        picsartContainer.x = leftmostX;
        picsartContainer.y = leftmostY + bottomLeftmostNode.height + 50;
      }
      
      figma.currentPage.appendChild(picsartContainer);
    }

    let existingGeneration: FrameNode | null = null;
    let maxImageNumber = 0;
    
    for (let i = 0; i < picsartContainer.children.length; i++) {
      const child = picsartContainer.children[i];
      if (child.type === "FRAME" && child.name.startsWith("Generation:")) {
        const generationFrame = child as FrameNode;
        
        const textNodes = generationFrame.findAll(node => node.type === "TEXT") as TextNode[];
        for (const textNode of textNodes) {
          if (typeof textNode.characters === 'string' && textNode.characters.includes(prompt)) {
            console.log(`Found existing generation for prompt: "${prompt}"`);
            existingGeneration = generationFrame;
            
            const imagesFrame = generationFrame.findOne(node => 
              node.type === "FRAME" && node.name === "Generated Images"
            ) as FrameNode;
            
            if (imagesFrame) {
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
      imagesFrame = existingGeneration.findOne(node => 
        node.type === "FRAME" && node.name === "Generated Images"
      ) as FrameNode;
      
      console.log(`Adding to existing generation. Current images: ${maxImageNumber}`);
    } else {
      const generationGroup = figma.createFrame();
      generationGroup.name = `Generation: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`;
      generationGroup.layoutMode = "VERTICAL";
      generationGroup.primaryAxisSizingMode = "AUTO";
      generationGroup.counterAxisSizingMode = "FIXED";
      generationGroup.paddingTop = 16;
      generationGroup.paddingBottom = 16;
      generationGroup.paddingLeft = 16;
      generationGroup.paddingRight = 16;
      generationGroup.itemSpacing = 12;
      generationGroup.fills = [{ type: "SOLID", color: { r: 0.15, g: 0.15, b: 0.15 } }];
      generationGroup.cornerRadius = 8;
      generationGroup.resize(2048, 200);

      const promptText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      promptText.fontName = { family: "Inter", style: "Medium" };
      promptText.characters = prompt;
      promptText.fontSize = 14;
      promptText.fills = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
      promptText.resize(2000, promptText.height);
      
      imagesFrame = figma.createFrame();
      imagesFrame.name = "Generated Images";
      imagesFrame.layoutMode = "HORIZONTAL";
      imagesFrame.primaryAxisSizingMode = "AUTO";
      imagesFrame.counterAxisSizingMode = "AUTO";
      imagesFrame.itemSpacing = 12;
      imagesFrame.fills = [];

      generationGroup.appendChild(promptText);
      generationGroup.appendChild(imagesFrame);
      picsartContainer.appendChild(generationGroup);
      
      console.log(`Created new generation for prompt: "${prompt}"`);
    }

    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      const imageNumber = maxImageNumber + i + 1;
      
      try {
        console.log(`Creating image ${imageNumber}, size: ${imageData.byteLength} bytes`);
        
        const imageNode = figma.createRectangle();
        imageNode.name = `Image ${imageNumber}`;
        
        const imageHash = figma.createImage(imageData);
        
        imageNode.fills = [{
          type: "IMAGE",
          imageHash: imageHash.hash,
          scaleMode: "FILL"
        }];
        
        imageNode.resize(1024, 1024);
        
        imagesFrame.appendChild(imageNode);
        console.log(`Successfully added Image ${imageNumber}`);
        
      } catch (error) {
        console.error(`Error adding image ${imageNumber}:`, error);
      }
    }

    const totalImagesInFrame = imagesFrame.children.length;
    const imagesFrameWidth = (totalImagesInFrame * 1024) + ((totalImagesInFrame - 1) * imagesFrame.itemSpacing);
    const imagesFrameHeight = 1024;
    
    imagesFrame.resize(imagesFrameWidth, imagesFrameHeight);
    
    const generationGroup = imagesFrame.parent as FrameNode;
    if (generationGroup && generationGroup.name.startsWith("Generation:")) {
      const promptTextHeight = generationGroup.children[0].height;
      const generationWidth = Math.max(imagesFrameWidth, 2000) + generationGroup.paddingLeft + generationGroup.paddingRight;
      const generationHeight = promptTextHeight + imagesFrameHeight + generationGroup.itemSpacing + generationGroup.paddingTop + generationGroup.paddingBottom;
      
      generationGroup.resize(generationWidth, generationHeight);
    }

    let totalHeight = picsartContainer.paddingTop + picsartContainer.paddingBottom;
    let maxWidth = 2200;

    for (let i = 0; i < picsartContainer.children.length; i++) {
      const child = picsartContainer.children[i];
      totalHeight += child.height;
      const childRequiredWidth = child.width + picsartContainer.paddingLeft + picsartContainer.paddingRight;
      if (childRequiredWidth > maxWidth) {
        maxWidth = childRequiredWidth;
      }
      
      if (i > 0) totalHeight += picsartContainer.itemSpacing;
    }

    console.log(`Container now has ${picsartContainer.children.length} generations`);
    console.log(`Calculated total height: ${totalHeight}, max width: ${maxWidth}`);

    picsartContainer.resize(maxWidth, totalHeight);
    
    console.log(`Container resized to: ${picsartContainer.width}x${picsartContainer.height}`);

    figma.viewport.scrollAndZoomIntoView([picsartContainer]);

    return `Successfully added ${images.length} generated image${images.length > 1 ? 's' : ''} to Figma canvas`;

  } catch (error) {
    console.error("Error in addGeneratedImages:", error);
    return `Failed to add generated images: ${error}`;
  }
};

const actions = { processImage, setFetchedImage, addGeneratedImages };

export default actions;