import React, { useEffect, useState } from "react";
import { getBalance } from "@api/index";
import { Button } from "@components/index";
import { BtnType, TabType } from "../../types/enums";
import { PRICING } from "@constants/url";
import "./styles.scss";

interface AccountProps {
  gottenKey: string;
  changeTab: (tab: TabType) => void;
}

const Account: React.FC<AccountProps> = ({ gottenKey, changeTab }) => {
  const [keyBalance, setKeyBalance] = useState<number | null>(null);

  useEffect(() => {
    const getBalanceRequest = async () => {
      const response: GetBalanceReturnType = await getBalance(gottenKey);
      if (response.success) {
        setKeyBalance(response.msg as number);
      }
    };

    getBalanceRequest();
  }, []);

  return (
    <div className="account-container">
      <div className="balance-text">
        <span className="text">Account current balance</span>
        <span className="credits-text">{keyBalance} credits</span>
      </div>
      <Button type={BtnType.BUY_MORE} cb={() => window.open(PRICING, "_blank")} tabIndex={8} />
      <Button type={BtnType.CHANGE_KEY} cb={() => changeTab(TabType.SET_API_KEY)} tabIndex={9} />
    </div>
  );
};

export default Account;
