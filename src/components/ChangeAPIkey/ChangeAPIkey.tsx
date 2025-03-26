import React, { useState } from "react";
import { getBalance, sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType } from "../../types/enums";
import {
  KEY_WRONG_ERR,
  PRICING,
  KEY_SET,
  TYPE_SET_KEY,
} from "@constants/index";
import "./styles.scss";

interface props {
  changeKey: (key: string) => void;
}

const ChangeAPIkey: React.FC<props> = ({changeKey}) => {
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newValue = event.target.value;
    setValue(newValue);
    setMessagesAsDefault();
  };

  const setMessagesAsDefault = () => {
    setError("");
  };

  const checkKey = async () => {
    const response: GetBalanceReturnType = await getBalance(value);
    if (response.success) {
      setSuccess(KEY_SET);
      setError("");
      sendMessageToSandBox(true, value, TYPE_SET_KEY);
      changeKey(value);
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
        cb={() => window.open(PRICING, "_blank")}
      />
    </div>
  );
};

export default ChangeAPIkey;
