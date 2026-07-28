import { TOKEN_ERR, BALANACE, HEADERAPI, PICSARTURL, GENAIURL, UPSCALE, GENERATEIMAGE, KEY_WRONG_ERR, REMOVEBG, REMOVEBG_SHADOW_DISABLED, REMOVEBG_SHADOW_CUSTOM } from "@constants/index";
import getImageBinary from "@utils/imageprocessor";
import { customFetch } from "./customFetch";

interface BalanceResponse {
    message?: string;
    credits?: number;
}

interface GenerateImageResponse {
    inference_id?: string;
    status: string;
    message?: string;
    detail?: string;
}

interface GenerateImageStatusResponse {
    status: string;
    data?: Array<{
        id: string;
        url: string;
        status: string;
    }>;
    message?: string;
    detail?: string;
}

interface GenerateImageOptions {
    width: number;
    height: number;
    style: string;
    negative_prompt?: string;
    count?: number;
    model?: string;
}

// Advanced removebg parameters. Every field is optional and only sent when set,
// so a request built from the UI defaults matches the one this plugin sent
// before advanced settings existed.
interface RemoveBackgroundOptions {
    output_type?: string;
    format?: string;
    model?: string;
    bg_color?: string;
    bg_blur?: number;
    scale?: string;
    auto_center?: boolean;
    stroke_size?: number;
    stroke_color?: string;
    stroke_opacity?: number;
    shadow?: string;
    shadow_opacity?: number;
    shadow_blur?: number;
    shadow_offset_x?: number;
    shadow_offset_y?: number;
}

// The GenAI API reports lowercase statuses ("processing", "success") while an
// earlier revision of this endpoint used uppercase ones ("FINISHED", "DONE").
// Match case-insensitively against both so a vocabulary change on either side
// cannot turn a finished generation back into a timeout.
const SUCCESS_STATUSES = ["success", "finished", "done"];

const isStatus = (status: string | undefined, expected: string[]): boolean =>
    !!status && expected.indexOf(status.toLowerCase()) !== -1;

export const extractCreditsFromResponse = (response: Response): number | null => {
    const creditsHeader = response.headers.get('x-picsart-credit-available');
    if (creditsHeader) {
        const credits = parseInt(creditsHeader, 10);
        if (!isNaN(credits)) {
            return credits;
        }
    }
    return null;
};

export const sendMessageToSandBox = (success: boolean, msg: string | Uint8Array, type? : string, scaleFactor? : number, additionalData?: Record<string, unknown>) => {
     
    parent.postMessage({ pluginMessage: {
      success,
      msg,
      type,
      scaleFactor,
      ...additionalData
    }}, "*" );
}   

export const getBalance = async (key: string) : Promise<GetBalanceReturnType> => {
    try {
        const response = await customFetch(PICSARTURL + BALANACE, { headers: { [HEADERAPI] : key }});
        const res : BalanceResponse = await response.json();

        if (res.message !== TOKEN_ERR) {
            return {
                success: true,
                msg: res.credits
            }
        } else {
            return {
                success: false,
                msg: KEY_WRONG_ERR
            }
        }
    } catch (error) {
        return {
            success: false,
            msg: (error as string)
        }
    }
};

export const generateImage = async (prompt: string, key: string, options: GenerateImageOptions) => {
    if (!prompt) {
        return { success: false, msg: "Prompt is required" };
    }

    try {
        const response = await fetch(GENAIURL + GENERATEIMAGE, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                [HEADERAPI]: key,
                "X-Picsart-Plugin": "Figma",
            },
            body: JSON.stringify({
                prompt,
                negative_prompt: options.negative_prompt || "",
                width: options.width,
                height: options.height,
                count: options.count || 1,
                style: options.style,
                // Omitted rather than sent empty, so the API applies its own
                // default model when the user has not picked one.
                ...(options.model ? { model: options.model } : {}),
            }),
        })
        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);
        const res: GenerateImageResponse = await response.json();
        
        // An accepted job is identified by 202 plus the id we need to poll with,
        // not by the status string: the API answers "processing" here, so
        // matching on a literal would reject the request it just accepted.
        if (response.status === 202 && res.inference_id) {
            return {
                success: true,
                msg: "Image generation started",
                inferenceId: res.inference_id,
                updatedCredits: updatedCredits
            };
        } else if (response.status === 401 && res.message === "token_error") {
            return { success: false, msg: TOKEN_ERR };
        } else {
            return { success: false, msg: res.detail || res.message || "Unknown error occurred" };
        }
    } catch (error) {
        console.error("Error generating image:", error);
        return { success: false, msg: "Network error occurred" };
    }
};

export const checkGenerateImageStatus = async (inferenceId: string, key: string) => {
    try {
        const response = await customFetch(`${GENAIURL}${GENERATEIMAGE}/inferences/${inferenceId}`, {
            method: "GET",
            headers: { 
                [HEADERAPI]: key,
                "X-Picsart-Plugin": "Figma"
            },
        });

        const res: GenerateImageStatusResponse = await response.json();
        if (response.status === 401 && res.message === "token_error") {
            return { status: "error", msg: TOKEN_ERR };
        }
        
        if (isStatus(res.status, SUCCESS_STATUSES) && res.data) {
            // Return all completed image URLs
            const completedImages = res.data.filter(item => isStatus(item.status, SUCCESS_STATUSES));
            if (completedImages.length > 0) {
                return {
                    status: "FINISHED",
                    msg: "Images generated successfully",
                    imageUrls: completedImages.map(img => img.url)
                };
            }
        }

        // Still in flight, or a terminal failure the caller reports verbatim —
        // prefer the API's own wording over echoing the bare status back.
        return { status: res.status, msg: res.detail || res.message || res.status };
    } catch (error) {
        console.error("Error checking image generation status:", error);
        return { status: "error", msg: "Failed to check status" };
    }
};

export const downloadGeneratedImages = async (imageUrls: string[]) => {
    try {
        const downloadPromises = imageUrls.map(async (url, index) => {
            const imageResponse = await fetch(url);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download image ${index + 1}: ${imageResponse.status}`);
            }
            
            const blob = await imageResponse.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        });

        const imageArrays = await Promise.all(downloadPromises);
        return { success: true, images: imageArrays };

    } catch (error) {
        console.error("Error downloading generated images:", error);
        return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
};

export const downloadGeneratedImage = async (imageUrl: string) => {
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        
        const blob = await imageResponse.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        return { success: true, msg: uint8Array };

    } catch (error) {
        console.error("Error downloading generated image:", error);
        return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
};

export const removeBackgroundApi = async (imageBytes: Uint8Array, key: string, options: RemoveBackgroundOptions = {}) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        formData.append("image", imageBinary);

        if (options.output_type) formData.append("output_type", options.output_type);
        if (options.format) formData.append("format", options.format);
        if (options.model) formData.append("model", options.model);
        if (options.scale) formData.append("scale", options.scale);
        if (options.auto_center) formData.append("auto_center", "true");
        if (options.bg_color) formData.append("bg_color", options.bg_color);
        if (options.bg_blur) formData.append("bg_blur", String(options.bg_blur));
        // The colour and opacity only mean something once a stroke has width,
        // so they ride along with stroke_size instead of being sent on their own.
        if (options.stroke_size) {
            formData.append("stroke_size", String(options.stroke_size));
            if (options.stroke_color) formData.append("stroke_color", options.stroke_color);
            if (options.stroke_opacity !== undefined) formData.append("stroke_opacity", String(options.stroke_opacity));
        }
        if (options.shadow && options.shadow !== REMOVEBG_SHADOW_DISABLED) {
            formData.append("shadow", options.shadow);
            if (options.shadow_opacity !== undefined) formData.append("shadow_opacity", String(options.shadow_opacity));
            if (options.shadow_blur !== undefined) formData.append("shadow_blur", String(options.shadow_blur));
            // Offsets are read only by the "custom" direction.
            if (options.shadow === REMOVEBG_SHADOW_CUSTOM) {
                if (options.shadow_offset_x !== undefined) formData.append("shadow_offset_x", String(options.shadow_offset_x));
                if (options.shadow_offset_y !== undefined) formData.append("shadow_offset_y", String(options.shadow_offset_y));
            }
        }

        const response = await customFetch(PICSARTURL + REMOVEBG, {
            method: "POST",
            headers: { [HEADERAPI]: key },
            body: formData,
        });

        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);

        const res = await response.json();
        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR};
        }

        const imageResponse = await fetch(res.data.url);
        const blob = await imageResponse.blob();

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        return { 
            success: true, 
            msg: uint8Array,
            updatedCredits: updatedCredits
        };

    } catch (error) {
        console.error("Error removing background:", error);
        return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
};

export const enhanceImage = async (imageBytes: Uint8Array, key: string, scaleFactor: number, format?: string) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        formData.append("image", imageBinary);
        formData.append('upscale_factor', scaleFactor.toString());
        if (format) formData.append("format", format);

        const response = await customFetch(PICSARTURL + UPSCALE, {
            method: "POST",
            headers: { [HEADERAPI]: key },
            body: formData,
        });

        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);

        const res = await response.json();

        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR };
        }

        const imageResponse = await fetch(res.data.url);
        const blob = await imageResponse.blob();

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        return { 
            success: true, 
            msg: uint8Array,
            updatedCredits: updatedCredits
        };

    } catch (error) {
        console.error("Error enhancing image:", error);
        return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
};

export default {
    getBalance,
    sendMessageToSandBox,
    removeBackgroundApi,
    enhanceImage,
    generateImage,
    checkGenerateImageStatus,
    downloadGeneratedImages,
    downloadGeneratedImage
}
