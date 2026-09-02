import {
  BACKGROUND_SUCC_REMOVED,
  EDIT_NOTHING_PLACED_ERR,
  NODE_CANNOT_HOLD_IMAGE_ERR,
  SOURCE_LAYER_GONE_ERR,
  SOURCE_LAYER_GONE_PLACED_ERR,
  SOURCE_LAYER_LOCKED_ERR,
  TYPE_IMAGE_SELECTED,
  UPSCALE_SUCC_COMPLETED,
} from "../constants/index";
import type { BytesFailureReason, SelectionDescriptor } from "@app-types/messages";
import { postToUi } from "./UiBridge";

/**
 * The outcome of a canvas write.
 *
 * These functions used to return a bare string that was either a success message or
 * an error message, and the only consumer passed it straight to `figma.notify`. Now
 * that the UI waits for a placement acknowledgement, something has to say which of
 * the two it was — comparing the string against the success constants would put the
 * answer in two places and let them drift.
 */
export interface PlacementResult {
  ok: boolean;
  message: string;
}

/** What a byte read produced, and when it produced nothing, why. */
export type BytesReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: BytesFailureReason; error?: string };

/**
 * The image paint on a node, if it has one.
 *
 * `fills` can be `figma.mixed` on a node with per-region paints, and reading it as
 * an array in that case yields a symbol that `.find` throws on. The old code cast
 * straight to ReadonlyArray<Paint> and got away with it only because it never
 * accepted the node types where mixed fills occur.
 */
const imageFillOf = (node: BaseNode): ImagePaint | null => {
  if (!("fills" in node)) return null;
  const fills = (node as GeometryMixin).fills;
  if (typeof fills === "symbol" || !Array.isArray(fills)) return null;
  const found = (fills as ReadonlyArray<Paint>).find(
    (fill): fill is ImagePaint => fill.type === "IMAGE" && !!fill.imageHash
  );
  return found ?? null;
};

/**
 * The node that actually carries the image, which is not always the node the user
 * clicked.
 *
 * A GROUP has `resize` but no `fills`, so it can never be written to — widening
 * the read path to accept groups without this resolution step would have produced
 * a charge-then-fail: the API call succeeds, the paid result arrives, and the
 * write silently does nothing. A FRAME, COMPONENT or INSTANCE may carry the fill
 * itself or contain a child that does.
 *
 * Read and write both go through here, so they always target the same node.
 */
const resolveImageNode = (node: BaseNode): SceneNode | null => {
  if (imageFillOf(node)) return node as SceneNode;
  if ("findOne" in node) {
    const child = (node as ChildrenMixin).findOne((candidate) => !!imageFillOf(candidate));
    if (child) return child;
  }
  return null;
};

// Widened from the original six. A framed image is the single most common way a
// photo sits in a real Figma file, and it used to fall through to "nothing
// selected" — which in Generate Image meant silently running a billable
// text-to-image instead of the edit the user asked for.
const SELECTABLE_TYPES = [
  "RECTANGLE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "TEXT",
  "FRAME",
  "GROUP",
  "COMPONENT",
  "INSTANCE",
];

/**
 * Bring a placed node into view, but only if it is not already there.
 *
 * `scrollAndZoomIntoView` unconditionally hijacks the viewport, which is hostile
 * when the result landed right beside the layer the user is already looking at: it
 * re-zooms their canvas for no reason. Reading `figma.viewport.bounds` first makes
 * the scroll a rescue rather than a reflex.
 */
const revealIfOffscreen = (figma: PluginAPI, ...nodes: SceneNode[]) => {
  if (nodes.length === 0) return;
  // Wholly inside a try, including the scroll. By the time this runs the images are
  // placed and paid for, so a viewport call that throws must not turn a completed
  // placement into a reported failure — the worst case here is a canvas that did not
  // move, which the user can fix by scrolling.
  try {
    const view = figma.viewport.bounds;
    const allVisible = nodes.every(
      (node) =>
        node.x >= view.x &&
        node.y >= view.y &&
        node.x + node.width <= view.x + view.width &&
        node.y + node.height <= view.y + view.height
    );
    if (allVisible) return;
    figma.viewport.scrollAndZoomIntoView(nodes);
  } catch (error) {
    console.warn("Could not bring the placed result into view:", error);
  }
};

/**
 * The nearest locked ancestor, if any.
 *
 * Figma refuses a write to a node inside a locked parent with the same error it
 * gives for a locked node, so checking only the target reported the raw exception
 * for a case that has a plain-English explanation.
 */
const findLockedAncestor = (node: SceneNode): BaseNode | null => {
  let parent: BaseNode | null = node.parent;
  while (parent) {
    if ("locked" in parent && (parent as SceneNode).locked) return parent;
    parent = parent.parent;
  }
  return null;
};

/**
 * Describe the current selection without reading a single byte.
 *
 * The previous version called getBytesAsync on every selectionchange and posted
 * the full image across postMessage — for a 6000x4000 photo, on every click.
 * Bytes are now read once, on demand, for the node the user actually acted on.
 */
export const describeSelection = (figma: PluginAPI): SelectionDescriptor | null => {
  const selectedNodes = figma.currentPage.selection;
  if (selectedNodes.length === 0) return null;

  const selectedNode = selectedNodes[0];
  const imageNode =
    SELECTABLE_TYPES.indexOf(selectedNode.type) > -1
      ? resolveImageNode(selectedNode)
      : null;

  return {
    // The id of the node that holds the image, so a later apply writes to the
    // same place the bytes were read from.
    nodeId: (imageNode ?? selectedNode).id,
    nodeType: selectedNode.type,
    name: selectedNode.name,
    width: Math.round(selectedNode.width),
    height: Math.round(selectedNode.height),
    hasImageFill: !!imageNode,
    selectionCount: selectedNodes.length,
  };
};

export const sendImageSelectionStatus = (pluginApi: PluginAPI = figma) => {
  // Through the bridge, not straight to ui.postMessage. code.ts wires this to
  // figma.on("selectionchange"), which can fire before the iframe has mounted — on
  // launch, or while a tab switch is reloading it. A direct post in that window is
  // simply lost, and the banner then sits on whatever it last heard.
  postToUi(pluginApi, {
    type: TYPE_IMAGE_SELECTED,
    payload: describeSelection(pluginApi),
  });
};

/**
 * Read the bytes of one specific node, named by id rather than by "whatever is
 * selected".
 *
 * Returns a reason rather than a bare null on failure. "The layer was deleted",
 * "that layer holds no image" and "reading it threw" are three different sentences
 * for the user, and they all used to arrive as the same `null`.
 */
export const getBytesForNode = async (
  pluginApi: PluginAPI,
  nodeId: string
): Promise<BytesReadResult> => {
  // getNodeById throws outright under documentAccess: "dynamic-page", which this
  // plugin sets in manifest.json.
  const node = await pluginApi.getNodeByIdAsync(nodeId);
  if (!node || node.removed) return { ok: false, reason: "node-gone" };

  const imageFill = imageFillOf(node);
  if (!imageFill || !imageFill.imageHash) return { ok: false, reason: "no-image" };

  const image = pluginApi.getImageByHash(imageFill.imageHash);
  if (!image) return { ok: false, reason: "no-image" };

  const bytes = await image.getBytesAsync();
  // A zero-length fill is not a usable source, and it is not the same thing as an
  // absent one either — it is what an image whose bytes failed to load looks like.
  if (!bytes || !bytes.length) return { ok: false, reason: "no-image" };
  return { ok: true, bytes };
};

/**
 * Write a finished result onto the node it came from.
 *
 * Replaces setFetchedImage, which read `figma.currentPage.selection` at apply
 * time. Between pressing the button and the result arriving there is a 10-60
 * second window, and anything the user clicks in it moved the target: the paid
 * result landed on whichever layer happened to be selected when it came back.
 */
export const applyImageToNode = async (
  pluginApi: PluginAPI,
  nodeId: string,
  bytes: Uint8Array,
  scaleFactor?: number
): Promise<PlacementResult> => {
  const node = await pluginApi.getNodeByIdAsync(nodeId);
  if (!node || node.removed) return { ok: false, message: SOURCE_LAYER_GONE_ERR };

  const target = resolveImageNode(node) ?? (node as SceneNode);

  if (!("fills" in target) || !("resize" in target)) {
    return { ok: false, message: NODE_CANNOT_HOLD_IMAGE_ERR };
  }
  if ("locked" in target && target.locked) {
    return { ok: false, message: SOURCE_LAYER_LOCKED_ERR };
  }
  // A locked ancestor rejects the write just as a locked target does, and says so
  // with the same "node is locked" throw from somewhere further up. Named here
  // rather than left to the catch-all, which could only report the raw exception.
  const lockedAncestor = findLockedAncestor(target);
  if (lockedAncestor) {
    return { ok: false, message: SOURCE_LAYER_LOCKED_ERR };
  }

  // createImage runs FIRST, before anything on the canvas is touched.
  //
  // It hard-caps at 4096px in either dimension and throws "Image is too large"
  // past it, which an 8x upscale of an ordinary layer reaches easily. The resize
  // used to run first, so that throw left the layer permanently scaled 2-8x with
  // the OLD image still in it — a failed paid call that corrupted the canvas.
  let newImage: Image;
  try {
    newImage = pluginApi.createImage(bytes);
  } catch (error) {
    console.error("Failed to decode the result image:", error);
    return { ok: false, message: `${NODE_CANNOT_HOLD_IMAGE_ERR} (${String(error)})` };
  }

  const originalWidth = target.width;
  const originalHeight = target.height;

  try {
    if (typeof scaleFactor === "number" && scaleFactor > 1) {
      target.resize(target.width * scaleFactor, target.height * scaleFactor);
    }

    (target as GeometryMixin).fills = [
      { type: "IMAGE", imageHash: newImage.hash, scaleMode: "FILL" },
    ];
  } catch (error) {
    // resize throws inside an auto-layout or otherwise constrained parent. Put the
    // node back the size it was, so a failure leaves nothing half-applied.
    console.error("Failed to apply image to node:", error);
    try {
      target.resize(originalWidth, originalHeight);
    } catch (_restoreError) {
      // Nothing better to do: the layer is already in the state the first throw
      // left it, and reporting the restore failure over the real cause would hide
      // the useful half.
    }
    return { ok: false, message: `${NODE_CANNOT_HOLD_IMAGE_ERR} (${String(error)})` };
  }

  return {
    ok: true,
    message: scaleFactor ? UPSCALE_SUCC_COMPLETED : BACKGROUND_SUCC_REMOVED,
  };
};

/**
 * The text-to-image gallery.
 *
 * `figma` here is the injected PluginAPI, not the global — the parameter shadows it,
 * which is what makes this function testable and proves it cannot reach for the
 * global by accident. Its three siblings above already took the injection; this was
 * the one that did not, and it is also the only placement path in the plugin, so it
 * had none of the suite's coverage.
 */
export const addGeneratedImages = async (
  figma: PluginAPI,
  images: Uint8Array[],
  prompt: string
): Promise<PlacementResult> => {
  try {
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
            existingGeneration = generationFrame;
            
            const imagesFrame = generationFrame.findOne(node => 
              node.type === "FRAME" && node.name === "Generated Images"
            ) as FrameNode;
            
            if (imagesFrame) {
              const existingImages = imagesFrame.findAll(node => 
                node.type === "RECTANGLE" && node.name.startsWith("Image ")
              );
              maxImageNumber = existingImages.length;
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
    }

    let placedCount = 0;
    const failures: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const imageData = images[i];
      const imageNumber = maxImageNumber + i + 1;

      try {
        const imageNode = figma.createRectangle();
        imageNode.name = `Image ${imageNumber}`;

        const imageHash = figma.createImage(imageData);

        imageNode.fills = [{
          type: "IMAGE",
          imageHash: imageHash.hash,
          scaleMode: "FILL"
        }];

        // The image itself is the only reliable source of its dimensions. The
        // old hardcoded resize(1024, 1024) squashed every non-square aspect
        // preset into a square: Portrait, Landscape, Wide Screen, Story and
        // Banner all place distorted. Asking Figma for the decoded size also
        // stays correct for edit-mode output, whose dimensions track the source
        // layer rather than any preset.
        const { width, height } = await imageHash.getSizeAsync();
        imageNode.resize(width, height);

        imagesFrame.appendChild(imageNode);
        placedCount++;

      } catch (error) {
        // Kept non-fatal so one bad image does not discard the others, which
        // are already paid for. The count below reports what actually landed.
        console.error(`Error adding image ${imageNumber}:`, error);
        failures.push(String(error));
      }
    }

    // Derived from what was placed, not from an assumed 1024 square, or a row
    // of Banner images (1536x512) would overflow its frame by 50% per image.
    let imagesFrameWidth = 0;
    let imagesFrameHeight = 0;
    for (const child of imagesFrame.children) {
      imagesFrameWidth += child.width;
      imagesFrameHeight = Math.max(imagesFrameHeight, child.height);
    }
    if (imagesFrame.children.length > 1) {
      imagesFrameWidth += (imagesFrame.children.length - 1) * imagesFrame.itemSpacing;
    }

    imagesFrame.resize(Math.max(imagesFrameWidth, 1), Math.max(imagesFrameHeight, 1));
    
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

    picsartContainer.resize(maxWidth, totalHeight);

    revealIfOffscreen(figma, picsartContainer);

    // Report what landed, not what was requested. The per-image catch above
    // deliberately continues, so reporting images.length turned a partial
    // failure into a clean success message.
    if (placedCount === 0) {
      return {
        ok: false,
        message: `Failed to add generated images: ${failures[0] ?? "unknown error"}`,
      };
    }
    if (placedCount < images.length) {
      return {
        ok: false,
        message: `Added ${placedCount} of ${images.length} generated images; ${images.length - placedCount} could not be placed`,
      };
    }
    return {
      ok: true,
      message: `Added ${placedCount} generated image${placedCount > 1 ? "s" : ""} to the canvas`,
    };
  } catch (error) {
    console.error("Error in addGeneratedImages:", error);
    return { ok: false, message: `Failed to add generated images: ${error}` };
  }
};

/** Spacing between the source and the first candidate, and between candidates. */
const PLACEMENT_GAP = 24;
/** Layer names come from the prompt; the layer panel is narrow. */
const NAME_PROMPT_LENGTH = 40;

const candidateName = (prompt: string, index: number, total: number): string => {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  const excerpt =
    trimmed.length > NAME_PROMPT_LENGTH
      ? `${trimmed.slice(0, NAME_PROMPT_LENGTH)}…`
      : trimmed || "untitled";
  return total > 1 ? `Edit: ${excerpt} (${index + 1})` : `Edit: ${excerpt}`;
};

/**
 * Whether a container will accept a child positioned by absolute coordinates.
 *
 * An auto-layout frame owns its children's x/y, so "beside the source" is not
 * something that can be expressed inside one — the candidate would join the flow and
 * shove the user's design sideways. An INSTANCE refuses `appendChild` outright: its
 * children belong to the component. A locked parent refuses the write. All three used
 * to be uncaught throws on a result the user had already paid for.
 */
const canHostPlacement = (parent: BaseNode | null): boolean => {
  if (!parent) return false;
  if (parent.type === "INSTANCE") return false;
  if ("locked" in parent && (parent as SceneNode).locked) return false;
  if ("layoutMode" in parent && (parent as FrameNode).layoutMode !== "NONE") return false;
  return "appendChild" in parent;
};

export const placeBesideSource = async (
  figma: PluginAPI,
  options: { images: Uint8Array[]; prompt: string; sourceNodeId: string }
): Promise<PlacementResult> => {
  const { images, prompt, sourceNodeId } = options;
  if (images.length === 0) {
    return { ok: false, message: EDIT_NOTHING_PLACED_ERR };
  }

  const sourceNode = await figma.getNodeByIdAsync(sourceNodeId);
  if (!sourceNode || sourceNode.removed || !("width" in sourceNode)) {
    // The result exists and is paid for, so it is placed anyway — at the viewport
    // centre, since the layer that would have positioned it is gone. The rescue
    // registry promised a defined fallback here and the copy said the result was
    // discarded; the registry was right.
    return placeAtViewportCentre(figma, images, prompt);
  }

  const source = sourceNode as SceneNode;
  const parent = source.parent;
  const host = canHostPlacement(parent) ? (parent as BaseNode & ChildrenMixin) : null;
  const hostIsPage = !host;

  // Second-run safety: start past everything already occupying the source's row,
  // rather than assuming the space to the right is empty. Cheap, needs no stored
  // state, and stays correct if the user rearranges things between runs.
  let cursorX = source.x + source.width;
  const siblings = host ? host.children : figma.currentPage.children;
  for (const sibling of siblings) {
    if (sibling.id === source.id) continue;
    const overlapsBand =
      sibling.y < source.y + source.height && sibling.y + sibling.height > source.y;
    if (overlapsBand) {
      cursorX = Math.max(cursorX, sibling.x + sibling.width);
    }
  }

  const placed: SceneNode[] = [];
  const failures: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const image = figma.createImage(images[i]);
      const { width, height } = await image.getSizeAsync();

      const node = figma.createRectangle();
      node.name = candidateName(prompt, i, images.length);
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];

      // Height matches the source, width follows the candidate's own aspect ratio.
      // The fill keeps its full resolution — only the frame is scaled — so nothing
      // is lost, and a 4096px result does not dwarf a 400px source.
      const aspect = width && height ? width / height : 1;
      node.resize(Math.max(Math.round(source.height * aspect), 1), Math.max(Math.round(source.height), 1));

      (host ?? figma.currentPage).appendChild(node);
      // Set after appendChild: in a non-auto-layout parent the append can otherwise
      // reset the position that was just assigned.
      cursorX += PLACEMENT_GAP;
      node.x = cursorX;
      node.y = source.y;
      cursorX += node.width;

      placed.push(node);
    } catch (error) {
      // One bad candidate must not discard its siblings — they are already paid for.
      console.error(`Failed to place edit candidate ${i + 1}:`, error);
      failures.push(String(error));
    }
  }

  if (placed.length === 0) {
    return {
      ok: false,
      message: `${EDIT_NOTHING_PLACED_ERR} (${failures[0] ?? "unknown error"})`,
    };
  }

  // The output becomes the selection, which is what turns a duplicate-charge trap
  // into a loop: without it the source stays selected, the banner still says
  // "Editing this layer", and the next press re-edits and re-charges for the
  // original. See the post-run selection section of the layout spec.
  figma.currentPage.selection = placed;
  revealIfOffscreen(figma, source, ...placed);

  const suffix = hostIsPage
    ? " Its parent could not hold them, so they were added to the page."
    : "";
  if (placed.length < images.length) {
    return {
      ok: false,
      message: `Placed ${placed.length} of ${images.length} candidates beside “${source.name}”; ${images.length - placed.length} could not be placed.${suffix}`,
    };
  }
  return {
    ok: true,
    message: `Placed ${placed.length} candidate${placed.length > 1 ? "s" : ""} beside “${source.name}”.${suffix}`,
  };
};

/**
 * Last-resort destination when the source layer is gone by the time the result
 * arrives. The user has been charged; a defined position beats a discarded image.
 */
const placeAtViewportCentre = async (
  figma: PluginAPI,
  images: Uint8Array[],
  prompt: string
): Promise<PlacementResult> => {
  const placed: SceneNode[] = [];
  // Read defensively. This function only runs when something has already gone wrong
  // (the source layer vanished mid-call), and it is the last chance to salvage a paid
  // result — so a viewport that will not answer must not stop the images landing.
  let centre = { x: 0, y: 0 };
  try {
    centre = { x: figma.viewport.center.x, y: figma.viewport.center.y };
  } catch (error) {
    console.warn("Could not read the viewport centre; placing at the origin:", error);
  }
  let cursorX = centre.x;

  for (let i = 0; i < images.length; i++) {
    try {
      const image = figma.createImage(images[i]);
      const { width, height } = await image.getSizeAsync();
      const node = figma.createRectangle();
      node.name = candidateName(prompt, i, images.length);
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
      node.resize(Math.max(width, 1), Math.max(height, 1));
      figma.currentPage.appendChild(node);
      node.x = cursorX;
      node.y = centre.y;
      cursorX += node.width + PLACEMENT_GAP;
      placed.push(node);
    } catch (error) {
      console.error(`Failed to place orphaned edit candidate ${i + 1}:`, error);
    }
  }

  if (placed.length === 0) {
    return { ok: false, message: EDIT_NOTHING_PLACED_ERR };
  }
  figma.currentPage.selection = placed;
  revealIfOffscreen(figma, ...placed);
  return { ok: false, message: SOURCE_LAYER_GONE_PLACED_ERR };
};

const actions = {
  describeSelection,
  getBytesForNode,
  applyImageToNode,
  addGeneratedImages,
  placeBesideSource,
};

export default actions;