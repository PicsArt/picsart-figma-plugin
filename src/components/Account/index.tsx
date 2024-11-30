import React, { useEffect, useState } from "react";
import { PRICING } from "@constants/index";
import { getBalance } from '@api/index';
import "./styles.scss";

interface AccountProps {
  gottenKey : string;
}

const Account: React.FC<AccountProps> = ({ gottenKey }) => {
  const [keyBalance, setKeyBalance] = useState<number | null>(null);

  const sendMessageToSandBox = (success: boolean, msg: string) => {
    parent.postMessage({ pluginMessage: {
      success,
      msg
    }}, "*" );
  }

  useEffect(() => {
    const getBalanceRequest = async () => {
      const response : GetBalanceReturnType =  await getBalance(gottenKey);
      if (response.success) {
        setKeyBalance((response.msg as number));
        sendMessageToSandBox(true, (response.msg as string));
      } else {
        sendMessageToSandBox(false, (response.msg as string));
      }
    }

    getBalanceRequest();
  }, [])

  const handleOnClick = () => {
    sendMessageToSandBox(true, "openKeyChangePage");
  }

  const handleBtnClick = () => {
    window.open(PRICING, '_blank');
  }

  return (
    <div className="account-container">
        <p className="title">Current Balance</p>
        <p className="subtitle">Upgrade your plan for more credits</p>
        <span className="credits">{keyBalance} credits left </span>
        <div className="btn-container">
          <button className="buy-credits" onClick={handleBtnClick}>
              <a href="#">Buy more credits </a>
          </button>
        </div>
        <a onClick={handleOnClick} className="change-key" href="#">Change API Key </a>
    </div>
  );
};

export default Account;