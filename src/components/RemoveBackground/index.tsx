import React, { useEffect } from "react";
import { removeBackground, sendMessageToSandBox } from "@api/index";
import { PROCESSING_IMAGE, TYPE_IMAGEBYTES, TYPE_NOTIFY } from "@constants/index";

interface RemoveBackgroundProps {
    gottenKey: string; 
    imageBytes: Uint8Array;
}

const RemoveBackground: React.FC<RemoveBackgroundProps> = ({ gottenKey, imageBytes }) => {
    useEffect(() => {
        const processImage = async () => {
          sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

          const response = await removeBackground(imageBytes, gottenKey);
          sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES);
        };

        processImage();
    }, [gottenKey, imageBytes]);

    return (
        <></>
    );
};

export default RemoveBackground;
