import React, { useEffect, useState } from "react";
import { getBalance, sendMessageToSandBox } from "@api/index";
import "./styles.scss";
import { CONSOLE, LEARN_MORE, PICSART_IO } from "@constants/url";
import { TYPE_SET_KEY } from "@constants/types";

const IntroPage: React.FC = () => {
  const [value, setValue] = useState<string>("");
  const [disabled, setDisabled] = useState<boolean>(true);
  const [error, setError] = useState<string>();

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const newValue = event.target.value;
    setValue(newValue);
  };

  const handleClcik = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    if (value) {
      checkKey();
    }
  };

  const checkKey = async () => {
    const response: GetBalanceReturnType = await getBalance(value);
    if (response.success) {
      sendMessageToSandBox(true, value, TYPE_SET_KEY);
    } else {
      setError(response.msg as string);
      sendMessageToSandBox(false, response.msg as string, TYPE_SET_KEY);
    }
  };

  useEffect(() => {
    if (value) {
      setDisabled(false);
      setError("");
    } else {
      setDisabled(true);
      setError("");
    }
  }, [value]);

  return (
    <div className="intro-page">
      <div className="container">
        <div className="text-container">
          <span className="intro-text">
            1. To use the plugin, go to{" "}
            <a className="intro-href" href={PICSART_IO} target="_blank">
              {" "}
              Picsart.io
            </a>{" "}
            and create a free account.{" "}
          </span>
          <span className="intro-text">
            2. Go to the{" "}
            <a className="intro-href" href={CONSOLE} target="_blank">
              Console{" "}
            </a>
            , copy and past your API key here.{" "}
          </span>
        </div>
        <div className="input-btn-container">
          <div className="input-block">
            <input
              value={value}
              onChange={handleInputChange}
              placeholder="API Key"
              type="text"
              name="key"
              className={`keyset-input ${error ? "error-border" : ""}`}
            />
            {error && <span className="error-text">{error}</span>}
            <button
              onClick={handleClcik}
              className={`keyset-btn ${disabled ? "disabled-btn" : ""}`}
              type="button"
            >
              {" "}
              Continue
            </button>
          </div>
          <a className="key-learn-more" href={LEARN_MORE} rel="noreferrer" target="_blank">
            Learn about API key
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntroPage;
