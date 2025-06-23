import React, { useState, useEffect, useRef } from "react";
import { getBalance, sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType } from "../../types/enums";
import {
  KEY_WRONG_ERR,
  KEY_SET,
  TYPE_SET_KEY,
  APPS,
  TYPE_SET_BALANCE,
} from "@constants/index";
import "./styles.scss";

interface props {
  changeKey: (key: string) => void;
}

const ChangeAPIkey: React.FC<props> = ({ changeKey }) => {
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const safeApiKeyRegex = /^[A-Za-z0-9._-]+$/;

  useEffect(() => {
    // Auto-focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newValue = event.target.value;
    if (safeApiKeyRegex.test(newValue) || newValue === "") {
      setValue(newValue);
      setMessagesAsDefault();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      checkKey();
    }
  };

  const setMessagesAsDefault = () => {
    setError("");
  };

  const checkKey = async () => {
    if (!value) return;
    const response: GetBalanceReturnType = await getBalance(value);
    if (response.success) {
      setSuccess(KEY_SET);
      setError("");
      sendMessageToSandBox(true, value, TYPE_SET_KEY);
      changeKey(value);
      sendMessageToSandBox(true, String(response.msg), TYPE_SET_BALANCE);
    } else {
      setSuccess("");
      setError(KEY_WRONG_ERR);
    }
  };

  return (
    <div className="change-api-key">
      <span className="title">Picsart API Key</span>
      <div className="input-container">
        <input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="New API Key"
          type="text"
          name="key"
          className={`keyset-input`}
          tabIndex={8}
        />
      </div>
      {error && <span className="error-text">{error}</span>}
      {success && <span className="success-text">{success}</span>}
      <Button
        type={value ? BtnType.SUBMIT_ACTIVE : BtnType.SUBMIT_DISABLED}
        cb={checkKey}
        tabIndex={9}
      />
      <Button
        type={BtnType.NEW_KEY}
        cb={() => window.open(APPS, "_blank")}
        tabIndex={10}
      />
    </div>
  );
};

export default ChangeAPIkey;
