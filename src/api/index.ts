import { TOKEN_ERR, BALANACE, HEADERAPI, PICSARTURL, UPSCALE,  KEY_WRONG_ERR, REMOVEBG } from "@constants/index";
import getImageBinary from "@utils/imageprocessor";
import { customFetch } from "./customFetch";

interface BalanceResponse {
    message?: string;
    credits?: number;
}

export const sendMessageToSandBox = (success: boolean, msg: string | Uint8Array, type? : string, scaleFactor? : number) => {
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

export const removeBackground = async (imageBytes: Uint8Array, key: string) => {
    try {
        const imageBinary = await getImageBinary(imageBytes);

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

        const imageResponse = await customFetch(res.data.url);
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
        const imageBinary = await getImageBinary(imageBytes);

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

        const imageResponse = await customFetch(res.data.url);
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
    removeBackground,
    enhanceImage
}
