import React, { useState } from "react";
import { generateImageText2Image, checkText2ImageStatus, downloadGeneratedImage, sendMessageToSandBox } from "@api/index";
import {
  PRICING,
  PROCESSING_IMAGE,
  TYPE_NOTIFY,
  TYPE_IMAGEBYTES,
} from "@constants/index";
import { Button, LoadingSpinner } from "@components/index";
import { BtnType } from "../../types/enums";
import "./styles.scss";

interface GenerateImageProps {
  gottenKey: string;
  needToSetUpdateBalance: (arg: (number: number) => number) => void;
  isCreditsInsufficient: boolean;
}

const presetTags = ["Popular cat", "Ads", "Landscape"];
const aspectRatioOptions = ["Square", "Portrait", "Landscape", "Wide"];
const styleOptions = ["Pop art", "Realistic", "Cartoon", "Anime", "Abstract", "Vintage"];

const GenerateImage: React.FC<GenerateImageProps> = ({
  gottenKey,
  needToSetUpdateBalance,
  isCreditsInsufficient,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [prompt, setPrompt] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<string>("Square");
  const [style, setStyle] = useState<string>("Pop art");

  const pollForCompletion = async (inferenceId: string, key: string) => {
    const maxAttempts = 30; // 30 attempts with 2-second intervals = 1 minute max
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        sendMessageToSandBox(false, "Image generation timed out", TYPE_NOTIFY);
        setLoading(false);
        return;
      }

      attempts++;
      const statusResult = await checkText2ImageStatus(inferenceId, key);

      if (statusResult.status === "completed" && statusResult.imageUrl) {
        // Download the generated image
        const downloadResult = await downloadGeneratedImage(statusResult.imageUrl);
        if (downloadResult.success) {
          sendMessageToSandBox(true, downloadResult.msg as Uint8Array, TYPE_IMAGEBYTES);
          sendMessageToSandBox(true, "Image generated successfully!", TYPE_NOTIFY);
        } else {
          sendMessageToSandBox(false, downloadResult.msg as string, TYPE_NOTIFY);
        }
        setLoading(false);
        needToSetUpdateBalance((prev) => ++prev);
      } else if (statusResult.status === "failed" || statusResult.status === "error") {
        sendMessageToSandBox(false, statusResult.msg, TYPE_NOTIFY);
        setLoading(false);
      } else {
        // Still processing, continue polling
        setTimeout(poll, 2000);
      }
    };

    poll();
  };

  const handleSubmit = async () => {
    if (!gottenKey || isCreditsInsufficient || !prompt.trim()) return;
    setLoading(true);

    sendMessageToSandBox(true, PROCESSING_IMAGE, TYPE_NOTIFY);

    try {
      const response = await generateImageText2Image(prompt, gottenKey, { aspectRatio, style });
      
      if (response.success && response.inferenceId) {
        // Start polling for completion
        pollForCompletion(response.inferenceId, gottenKey);
      } else {
        sendMessageToSandBox(false, response.msg, TYPE_NOTIFY);
        setLoading(false);
      }
    } catch (error) {
      sendMessageToSandBox(false, "Failed to start image generation", TYPE_NOTIFY);
      setLoading(false);
    }
  };

  const handlePresetClick = (preset: string) => {
    if (prompt.trim()) {
      setPrompt(prev => prev + ", " + preset);
    } else {
      setPrompt(preset);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };

  let btnType = null;
  let cb = () => {};
  if (gottenKey && !isCreditsInsufficient && prompt.trim()) {
    btnType = BtnType.GENERATE_IMAGE_ACTIVE;
    cb = handleSubmit;
  } else if (gottenKey && isCreditsInsufficient) {
    btnType = BtnType.GENERATE_IMAGE_NO_CREDITS;
    cb = () => {
      window.open(PRICING, "_blank");
    };
  } else {
    btnType = BtnType.GENERATE_IMAGE_DISABLED;
  }

  if (isFullscreen) {
    return (
      <div className="generate-image-fullscreen">
        <div className="fullscreen-header">
          <button className="close-fullscreen" onClick={toggleFullscreen}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <textarea
          className="fullscreen-textarea"
          value={prompt}
          onChange={handlePromptChange}
          placeholder="Kangaroo carrying a corgi in cartoon style"
          autoFocus
        />
        <div className="fullscreen-button">
          <Button type={btnType} cb={cb} />
        </div>
        {loading && <LoadingSpinner />}
      </div>
    );
  }

  return (
    <div className="generate-image-container">
      <div className="prompt-section">
        <div className="prompt-header">
          <div className="prompt-label-container">
            <label className="prompt-label">Describe your image</label>
            <button className="info-icon" title="Write a detailed description of what you want to generate">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.3125 14.5C11.3125 14.6492 11.2532 14.7923 11.1477 14.8977C11.0423 15.0032 10.8992 15.0625 10.75 15.0625C10.4019 15.0625 10.0681 14.9242 9.82192 14.6781C9.57578 14.4319 9.4375 14.0981 9.4375 13.75V10C9.4375 9.95027 9.41775 9.90258 9.38258 9.86742C9.34742 9.83225 9.29973 9.8125 9.25 9.8125C9.10082 9.8125 8.95774 9.75324 8.85225 9.64775C8.74676 9.54226 8.6875 9.39918 8.6875 9.25C8.6875 9.10082 8.74676 8.95774 8.85225 8.85225C8.95774 8.74676 9.10082 8.6875 9.25 8.6875C9.5981 8.6875 9.93194 8.82578 10.1781 9.07192C10.4242 9.31806 10.5625 9.6519 10.5625 10V13.75C10.5625 13.7997 10.5823 13.8474 10.6174 13.8826C10.6526 13.9177 10.7003 13.9375 10.75 13.9375C10.8992 13.9375 11.0423 13.9968 11.1477 14.1023C11.2532 14.2077 11.3125 14.3508 11.3125 14.5ZM9.625 6.8125C9.81042 6.8125 9.99168 6.75752 10.1458 6.6545C10.3 6.55149 10.4202 6.40507 10.4911 6.23377C10.5621 6.06246 10.5807 5.87396 10.5445 5.6921C10.5083 5.51025 10.419 5.3432 10.2879 5.21209C10.1568 5.08098 9.98975 4.99169 9.8079 4.95551C9.62604 4.91934 9.43754 4.93791 9.26623 5.00886C9.09493 5.07982 8.94851 5.19998 8.8455 5.35415C8.74248 5.50832 8.6875 5.68958 8.6875 5.875C8.6875 6.12364 8.78627 6.3621 8.96209 6.53791C9.1379 6.71373 9.37636 6.8125 9.625 6.8125ZM19.5625 10C19.5625 11.8913 19.0017 13.7401 17.9509 15.3126C16.9002 16.8852 15.4067 18.1108 13.6594 18.8346C11.9121 19.5584 9.98939 19.7477 8.13445 19.3788C6.27951 19.0098 4.57563 18.099 3.23829 16.7617C1.90095 15.4244 0.990212 13.7205 0.621241 11.8656C0.25227 10.0106 0.441639 8.08791 1.1654 6.34059C1.88917 4.59327 3.11481 3.09981 4.68736 2.04907C6.2599 0.998331 8.10872 0.4375 10 0.4375C12.5352 0.440477 14.9657 1.44891 16.7584 3.24158C18.5511 5.03425 19.5595 7.46478 19.5625 10ZM18.4375 10C18.4375 8.33122 17.9426 6.69992 17.0155 5.31238C16.0884 3.92484 14.7706 2.84338 13.2289 2.20477C11.6871 1.56615 9.99064 1.39906 8.35393 1.72462C6.71721 2.05019 5.21379 2.85378 4.03379 4.03379C2.85378 5.21379 2.05019 6.71721 1.72462 8.35393C1.39906 9.99064 1.56615 11.6871 2.20477 13.2289C2.84338 14.7706 3.92484 16.0884 5.31238 17.0155C6.69992 17.9426 8.33122 18.4375 10 18.4375C12.237 18.435 14.3817 17.5453 15.9635 15.9635C17.5453 14.3817 18.435 12.237 18.4375 10Z" fill="#5A00EE"/>
              </svg>
            </button>
          </div>
          <button className="expand-icon" onClick={toggleFullscreen} title="Expand to fullscreen">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.0625 1.5V6C17.0625 6.14918 17.0032 6.29226 16.8977 6.39775C16.7923 6.50324 16.6492 6.5625 16.5 6.5625C16.3508 6.5625 16.2077 6.50324 16.1023 6.39775C15.9968 6.29226 15.9375 6.14918 15.9375 6V2.8575L10.8975 7.8975C10.7909 7.99686 10.6498 8.05095 10.5041 8.04838C10.3584 8.04581 10.2193 7.98678 10.1163 7.88372C10.0132 7.78066 9.95419 7.64162 9.95162 7.49589C9.94905 7.35017 10.0031 7.20913 10.1025 7.1025L15.1425 2.0625H12C11.8508 2.0625 11.7077 2.00324 11.6023 1.89775C11.4968 1.79226 11.4375 1.64918 11.4375 1.5C11.4375 1.35082 11.4968 1.20774 11.6023 1.10225C11.7077 0.996763 11.8508 0.9375 12 0.9375H16.5C16.6492 0.9375 16.7923 0.996763 16.8977 1.10225C17.0032 1.20774 17.0625 1.35082 17.0625 1.5ZM7.1025 10.1025L2.0625 15.1425V12C2.0625 11.8508 2.00324 11.7077 1.89775 11.6023C1.79226 11.4968 1.64918 11.4375 1.5 11.4375C1.35082 11.4375 1.20774 11.4968 1.10225 11.6023C0.996763 11.7077 0.9375 11.8508 0.9375 12V16.5C0.9375 16.6492 0.996763 16.7923 1.10225 16.8977C1.20774 17.0032 1.35082 17.0625 1.5 17.0625H6C6.14918 17.0625 6.29226 17.0032 6.39775 16.8977C6.50324 16.7923 6.5625 16.6492 6.5625 16.5C6.5625 16.3508 6.50324 16.2077 6.39775 16.1023C6.29226 15.9968 6.14918 15.9375 6 15.9375H2.8575L7.8975 10.8975C7.99686 10.7909 8.05095 10.6498 8.04838 10.5041C8.04581 10.3584 7.98678 10.2193 7.88372 10.1163C7.78066 10.0132 7.64162 9.95419 7.49589 9.95162C7.35017 9.94905 7.20913 10.0031 7.1025 10.1025Z" fill="#5A00EE"/>
            </svg>
          </button>
        </div>
        
        <div className="textarea-container">
          <textarea
            className="prompt-textarea"
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Kangaroo carrying a corgi in cartoon style"
            rows={4}
          />
          <div className="textarea-icons">
            <button className="edit-icon" title="Enhance prompt">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M1.953 0.91L1.638 2.17L0.378 2.485C-0.126 2.611 -0.126 3.329 0.378 3.455L1.638 3.77L1.953 5.03C2.08 5.534 2.797 5.534 2.923 5.03L3.238 3.77L4.498 3.455C5.003 3.329 5.003 2.611 4.498 2.485L3.238 2.17L2.924 0.91C2.797 0.405 2.079 0.405 1.953 0.91ZM9.793 1C9.98053 0.812529 10.2348 0.707214 10.5 0.707214C10.7652 0.707214 11.0195 0.812529 11.207 1L13 2.793C13.1875 2.98053 13.2928 3.23484 13.2928 3.5C13.2928 3.76516 13.1875 4.01947 13 4.207L11.354 5.853L4.5 12.707C4.31251 12.8946 4.0582 12.9999 3.793 13H2C1.73478 13 1.48043 12.8946 1.29289 12.7071C1.10536 12.5196 1 12.2652 1 12V10.207C1.00006 9.9418 1.10545 9.68749 1.293 9.5L8.146 2.646L9.793 1ZM9.207 3L11 4.793L12.293 3.5L10.5 1.707L9.207 3ZM10.293 5.5L8.5 3.707L2 10.207V12H3.793L10.293 5.5ZM10.839 10.87L11.119 9.75C11.202 9.417 11.675 9.417 11.759 9.75L12.039 10.87L13.158 11.15C13.491 11.233 13.491 11.707 13.158 11.79L12.038 12.07L11.758 13.19C11.675 13.522 11.202 13.522 11.118 13.19L10.838 12.07L9.719 11.79C9.386 11.707 9.386 11.233 9.719 11.15L10.839 10.87Z" fill="#5A00EE"/>
              </svg>
            </button>
          </div>
          <div className="tab-hint">tab</div>
        </div>
      </div>

      <div className="preset-tags">
        {presetTags.map((preset, index) => (
          <button
            key={index}
            className="preset-tag"
            onClick={() => handlePresetClick(preset)}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="advanced-settings">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={showAdvancedSettings}
            onChange={(e) => setShowAdvancedSettings(e.target.checked)}
          />
          <span className="toggle-switch"></span>
          <span className="toggle-label">Advanced settings</span>
        </label>

        {showAdvancedSettings && (
          <div className="advanced-options">
            <div className="option-group">
              <label className="option-label">Aspect ratio</label>
              <select
                className="option-select"
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
              >
                {aspectRatioOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="option-group">
              <label className="option-label">Style</label>
              <select
                className="option-select"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                {styleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <Button type={btnType} cb={cb} />
      
      {loading && <LoadingSpinner />}
    </div>
  );
};

export default GenerateImage;
