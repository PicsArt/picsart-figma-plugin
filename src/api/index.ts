import { TOKEN_ERR, BALANACE, HEADERAPI, PICSARTURL, GENAIURL, UPSCALE, GENERATEIMAGE, KEY_WRONG_ERR, REMOVEBG } from "@constants/index";
import getImageBinary from "@utils/imageprocessor";
import { customFetch } from "./customFetch";

interface BalanceResponse {
    message?: string;
    credits?: number;
}

interface GenerateImageResponse {
    status: string;
    msg: string;
    inferenceId?: string;
}

interface GenerateImageStatusResponse {
    status: string;
    msg: string;
    imageUrl?: string;
}

interface GenerateImageOptions {
    width: number;
    height: number;
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
            },
            body: JSON.stringify({
                prompt,
                ...options,
            }),
        });

        const res: GenerateImageResponse = await response.json();

        if (response.ok) {
            return {
                success: true,
                msg: res.msg,
                inferenceId: res.inferenceId,
            };
        } else {
            return { success: false, msg: res.msg };
        }
    } catch (error) {
        return { success: false, msg: "Network error occurred" };
    }
};

export const checkGenerateImageStatus = async (inferenceId: string, key: string) => {
    try {
        const response = await customFetch(`${GENAIURL}${GENERATEIMAGE}/inferences/${inferenceId}`, {
            method: "GET",
            headers: { [HEADERAPI]: key },
        });
        const res: GenerateImageStatusResponse = await response.json();
        return res;
    } catch (error) {
        return { status: "error", msg: "Failed to check status" };
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
    generateImage,
    checkGenerateImageStatus,
    downloadGeneratedImage
}
