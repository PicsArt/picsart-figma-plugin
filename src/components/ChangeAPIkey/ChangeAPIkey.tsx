import React, { useState } from "react";
import { getBalance, sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType } from "../../types/enums";
import {
  KEY_WRONG_ERR,
  KEY_SET,
  TYPE_SET_KEY,
  APPS,
} from "@constants/index";
import "./styles.scss";

interface props {
  changeKey: (key: string) => void;
  needToSetUpdateBalance: (arg: (number: number) => number) => void;
}

const ChangeAPIkey: React.FC<props> = ({ changeKey, needToSetUpdateBalance }) => {
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const safeApiKeyRegex = /^[A-Za-z0-9._-]+$/;

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newValue = event.target.value;
    if (safeApiKeyRegex.test(newValue) || newValue === "") {
      setValue(newValue);
      setMessagesAsDefault();
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
      needToSetUpdateBalance((prev) => ++prev);
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
          value={value}
          onChange={handleInputChange}
          placeholder="API Key"
          type="text"
          name="key"
          className={`keyset-input`}
        />
      </div>
      {error && <span className="error-text">{error}</span>}
      {success && <span className="success-text">{success}</span>}
      <Button
        type={value ? BtnType.SUBMIT_ACTIVE : BtnType.SUBMIT_DISABLED}
        cb={checkKey}
      />
      <Button
        type={BtnType.NEW_KEY}
        cb={() => window.open(APPS, "_blank")}
      />
    </div>
  );
};

export default ChangeAPIkey;
