import React, { useState } from "react";
import { getBalance, sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType } from "@app-types/enums";
import "./styles.scss";
import { CONSOLE, LEARN_MORE, PICSART_IO } from "@constants/url";
import { TYPE_SET_BALANCE, TYPE_SET_KEY } from "@constants/types";
import {
  SIGN_IN_CHOOSER_KEY_LEAD,
  SIGN_IN_CHOOSER_LEAD,
} from "@ui_constants/texts";
import { requestSignIn } from "@utils/credentialBridge";
import { useActive } from "../../context/ActiveContext";

interface Props {
  onSignIn?: () => void;
}

const IntroPage: React.FC<Props> = ({ onSignIn = requestSignIn }) => {
  const { isActive } = useActive();
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string>();
  const [checking, setChecking] = useState<boolean>(false);

  const canSubmit = !!value && !checking;

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setValue(event.target.value);
    setError("");
  };

  const checkKey = async () => {
    if (!canSubmit) return;
    setChecking(true);
    try {
      const response: GetBalanceReturnType = await getBalance(value);
      if (response.success) {
        sendMessageToSandBox(true, value, TYPE_SET_KEY);
        sendMessageToSandBox(true, String(response.msg), TYPE_SET_BALANCE);
      } else {
        setError(response.msg as string);
        sendMessageToSandBox(false, response.msg as string, TYPE_SET_KEY);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      checkKey();
    }
  };

  return (<>{ isActive &&
    <div className="intro-page">
      <div className="container">
        <div className="signin-choice">
          <span className="intro-text">{SIGN_IN_CHOOSER_LEAD}</span>
          <Button type={BtnType.SIGN_IN} cb={onSignIn} tabIndex={0} />
        </div>
        <div className="text-container">
          <span className="intro-text intro-alt-lead">{SIGN_IN_CHOOSER_KEY_LEAD}</span>
          <span className="intro-text">
            1. To use the plugin, go to{" "}
            <a className="intro-href" href={PICSART_IO} target="_blank" rel="noreferrer">
              {" "}
              Picsart.io
            </a>{" "}
            and create a free account.{" "}
          </span>
          <span className="intro-text">
            2. Go to the{" "}
            <a className="intro-href" href={CONSOLE} target="_blank" rel="noreferrer">
              Console{" "}
            </a>
            , copy and paste your API key here.{" "}
          </span>
        </div>
        <div className="input-btn-container">
          <div className="input-block">
            <input
              value={value}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="API Key"
              type="text"
              name="key"
              className={`keyset-input ${error ? "error-border" : ""}`}
              tabIndex={0}
            />
            {error && <span className="error-text">{error}</span>}
            <Button
              type={canSubmit ? BtnType.CONTINUE : BtnType.CONTINUE_DISABLED}
              cb={checkKey}
              tabIndex={0}
            />
          </div>
          <a className="key-learn-more" href={LEARN_MORE} rel="noreferrer" target="_blank">
            Learn about API key
          </a>
        </div>
      </div>
    </div>
}</>);
};

export default IntroPage;
