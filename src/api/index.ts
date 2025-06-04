import { TOKEN_ERR, BALANACE, HEADERAPI, PICSARTURL, GENAIURL, UPSCALE, TEXT2IMAGE, KEY_WRONG_ERR, REMOVEBG } from "@constants/index";
import getImageBinary from "@utils/imageprocessor";
import { customFetch } from "./customFetch";

interface BalanceResponse {
    message?: string;
    credits?: number;
}

interface Text2ImageResponse {
    inference_id: string;
    message?: string;
}

interface Text2ImageStatusResponse {
    status: string;
    data: {
        images: { url: string }[];
    };
    message?: string;
}

interface GenerateImageOptions {
    aspectRatio: string;
    style: string;
}

export const sendMessageToSandBox = (success: boolean, msg: string | Uint8Array, type? : string, scaleFactor? : number) => {
    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: {
      success,
      msg,
      type,
      scaleFactor
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

export const generateImageText2Image = async (prompt: string, key: string, options: GenerateImageOptions) => {
    try {
        const requestBody = {
            prompt: prompt,
            width: options.aspectRatio === "Portrait" ? 1024 : options.aspectRatio === "Wide" ? 2048 : 1024,
            height: options.aspectRatio === "Portrait" ? 2048 : options.aspectRatio === "Landscape" ? 1024 : 1024,
            count: 1
        };

        const response = await fetch(GENAIURL + TEXT2IMAGE, {
            method: "POST",
            headers: { 
                [HEADERAPI]: key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
        });

        const res: Text2ImageResponse = await response.json();
        
        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR, inferenceId: null };
        }

        if (!res.inference_id) {
            return { success: false, msg: "Failed to start image generation", inferenceId: null };
        }

        return { success: true, msg: "Generation started", inferenceId: res.inference_id };

    } catch (error) {
        console.error("Error generating image:", error);
        return { success: false, msg: error instanceof Error ? error.message : String(error), inferenceId: null };
    }
};

export const checkText2ImageStatus = async (inferenceId: string, key: string) => {
    try {
        const response = await customFetch(`${GENAIURL}${TEXT2IMAGE}/inferences/${inferenceId}`, {
            method: "GET",
            headers: { [HEADERAPI]: key },
        });

        const res: Text2ImageStatusResponse = await response.json();

        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR, status: "error", imageUrl: null };
        }

        if (res.status === "completed" && res.data && res.data.images && res.data.images.length > 0) {
            return { 
                success: true, 
                msg: "Image generated successfully", 
                status: "completed", 
                imageUrl: res.data.images[0].url 
            };
        } else if (res.status === "processing" || res.status === "pending") {
            return { 
                success: true, 
                msg: "Still processing", 
                status: res.status, 
                imageUrl: null 
            };
        } else {
            return { 
                success: false, 
                msg: "Generation failed", 
                status: "failed", 
                imageUrl: null 
            };
        }

    } catch (error) {
        console.error("Error checking image status:", error);
        return { 
            success: false, 
            msg: error instanceof Error ? error.message : String(error), 
            status: "error", 
            imageUrl: null 
        };
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

        const res = await response.json();
        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR};
        }

        const imageResponse = await fetch(res.data.url);
        const blob = await imageResponse.blob();

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        return { success: true, msg: uint8Array };

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

        const res = await response.json();

        if (res.message === TOKEN_ERR) {
            return { success: false, msg: TOKEN_ERR };
        }

        const imageResponse = await fetch(res.data.url);
        const blob = await imageResponse.blob();

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        return { success: true, msg: uint8Array };

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
    generateImageText2Image,
    checkText2ImageStatus,
    downloadGeneratedImage
}
