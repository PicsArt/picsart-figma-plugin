import React, { useEffect } from "react";
import { sendMessageToSandBox } from "@api/index";
import { Button } from "@components/index";
import { BtnType, TabType } from "@app-types/enums";
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
    setIsCreditsInsufficient(balance <= 0);
  }, [ gottenKey ]);

  return (
    <div className="account-container">
      <div className="balance-text">
        <span className="text">Account current balance</span>
        <span className="credits-text">{balance} credits</span>
      </div>
      <Button type={BtnType.BUY_MORE} cb={() => window.open(PRICING, "_blank")} tabIndex={0} />
      <Button type={BtnType.CHANGE_KEY} cb={() => changeTab(TabType.SET_API_KEY)} tabIndex={0} />
    </div>
  );
};

export default Account;
