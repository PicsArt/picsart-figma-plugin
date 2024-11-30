import React, { useState } from "react";
import { PRICING } from "@constants/index";
import { getBalance, sendMessageToSandBox } from '@api/index';
import "./styles.scss"

const ChangeAPIkey : React.FC = () => {
  const [value, setValue ] = useState<string>("");
  const [error, setError] = useState<string>();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) : void => {
    const newValue = event.target.value;
    setValue(newValue);
    setMessagesAsDefault();
  };

  const setMessagesAsDefault = () => {
    setError('');
  }

  const checkKey = async () => {
    const response : GetBalanceReturnType = await getBalance(value);
    if (response.success) {
      sendMessageToSandBox(true, value);
    } else {
      sendMessageToSandBox(false, (response.msg as string));
    }
  }
  
  const handlehrefClick = () => {
    window.open(PRICING, '_blank');
  }

 return (
    <div className="change-api-key-modal">
        <h1 className="title">Enter your Picsart API Key</h1>
        <div className="input-container">
            <input value={value} onChange={handleInputChange} placeholder="API Key" type="text" name="key" className={`keyset-input ${error ? "error-border" : "" }`} />
            { error && <span className="error-text">{ error }</span>}
            <button onClick={checkKey} className={`submit ${!value ? "disabled-btn" : ""}`}> Submit </button>
            <a onClick={handlehrefClick} className="get-key" href="#">Get your Picsart API Key</a>
        </div>
    </div>
  )
}

export default ChangeAPIkey;