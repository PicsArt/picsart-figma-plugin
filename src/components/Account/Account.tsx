import React, { useEffect } from "react";
import { sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType, TabType } from "../../types/enums";
import { PRICING } from "@constants/url";
import "./styles.scss";
import { useBalance } from "../../context/BalanceContext";
import { TYPE_GET_BALANCE } from "@constants/types";

interface AccountProps {
  gottenKey: string;
  changeTab: (tab: TabType) => void;
  setIsCreditsInsufficient: (status: boolean) => void;
}

const Account: React.FC<AccountProps> = ({ setIsCreditsInsufficient, gottenKey, changeTab }) => {
  const { balance } = useBalance();

  useEffect(() => {
    sendMessageToSandBox(true, "", TYPE_GET_BALANCE);
    balance <= 0 ? setIsCreditsInsufficient(false) : setIsCreditsInsufficient(true);
  }, [ gottenKey ]);

  return (
    <div className="account-container">
      <div className="balance-text">
        <span className="text">Account current balance</span>
        <span className="credits-text">{balance} credits</span>
      </div>
      <Button type={BtnType.BUY_MORE} cb={() => window.open(PRICING, "_blank")} tabIndex={8} />
      <Button type={BtnType.CHANGE_KEY} cb={() => changeTab(TabType.SET_API_KEY)} tabIndex={9} />
    </div>
  );
};

export default Account;
