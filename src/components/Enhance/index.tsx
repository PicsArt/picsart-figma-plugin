import React, { useState } from "react";
import Selector from "@components/Selector";
import { enhanceImage, sendMessageToSandBox } from "@api/index";
import { PROCESSING_IMAGE, TYPE_IMAGEBYTES, TYPE_NOTIFY } from "@constants/index";
import './styles.scss';

interface UpscaleProps {
    gottenKey: string; 
    imageBytes: Uint8Array;
}
const options = ['2', '4', '6', '8'];

const Enhance: React.FC<UpscaleProps> = ({ gottenKey, imageBytes }) => {
    const [scaleFactor, setScaleFactor] = useState(0);

    const handleSubmit = async () => {
        if (!scaleFactor) return;
        sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

        const response = await enhanceImage(imageBytes, gottenKey, scaleFactor);
        sendMessageToSandBox(response.success, response.msg, TYPE_IMAGEBYTES, scaleFactor);
    }

    const handleOnChange = (val : string) => {
        setScaleFactor(Number(val))
    }

    return (
        <div className="upscale-container">
           <p className="text">Take the work out of getting sizing right. Allow users to upload images of any size without loss to photo quality.</p>
            <Selector 
              onChange={handleOnChange} 
              options={options} 
              text="Enhnace Factor"
            />
            <button onClick={handleSubmit} className={`keyset-btn ${scaleFactor == 0 ? "disabled-btn" : ''}`} type="button"> Start Proccesing</button>
        </div>
    );
}

export default Enhance;
