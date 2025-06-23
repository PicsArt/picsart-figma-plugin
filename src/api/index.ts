import { TOKEN_ERR, BALANACE, HEADERAPI, PICSARTURL, GENAIURL, UPSCALE, GENERATEIMAGE, KEY_WRONG_ERR, REMOVEBG } from "@constants/index";
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
}

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

export const sendMessageToSandBox = (success: boolean, msg: string | Uint8Array, type? : string, scaleFactor? : number, additionalData?: any) => {
    // eslint-disable-next-line no-restricted-globals
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
        let response = await customFetch(PICSARTURL + BALANACE, { headers: { [HEADERAPI] : key }});
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
            }),
        })
        // Extract credits from response header
        const updatedCredits = extractCreditsFromResponse(response);
        const res: GenerateImageResponse = await response.json();
        
        if (response.status === 202 && res.status === "ACCEPTED") {
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
        
        if (res.status === "FINISHED" && res.data) {
            // Return all completed image URLs
            const completedImages = res.data.filter(item => item.status === "DONE");
            if (completedImages.length > 0) {
                return { 
                    status: "FINISHED", 
                    msg: "Images generated successfully", 
                    imageUrls: completedImages.map(img => img.url)
                };
            }
        }
        
        return { status: res.status, msg: res.status };
    } catch (error) {
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

export const removeBackgroundApi = async (imageBytes: Uint8Array, key: string) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        formData.append("image", imageBinary);

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

export const enhanceImage = async (imageBytes: Uint8Array, key: string, scaleFactor: number) => {
    try {
        const imageBinary = await getImageBinary(imageBytes.buffer as ArrayBuffer);

        const formData = new FormData();
        formData.append("size", "auto");
        formData.append("image", imageBinary);
        formData.append('upscale_factor', scaleFactor.toString());

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
