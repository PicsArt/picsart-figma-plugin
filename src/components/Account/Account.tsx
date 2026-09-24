import React, { useEffect } from "react";
import { sendMessageToSandBox } from "@api/index";
import { Button, ChangeAPIkey } from "@components/index";
import { BtnType } from "@app-types/enums";
import type { CredentialDescriptor } from "@app-types/credential";
import useBalanceRecovery from "@hooks/useBalanceRecovery";
import "./styles.scss";
import { useBalance } from "../../context/BalanceContext";
import { TYPE_GET_BALANCE } from "@constants/types";
import {
  ACCOUNT_KEY_RETAINED,
  ACCOUNT_MODE_API_KEY,
  ACCOUNT_MODE_LABEL,
  ACCOUNT_MODE_OAUTH,
} from "@ui_constants/texts";
import { requestSignOut } from "@utils/credentialBridge";

interface AccountProps {
  credential: CredentialDescriptor | null;
  apiKey: string;
  setIsCreditsInsufficient: (status: boolean) => void;
  onSignIn: () => void;
  changeKey: (key: string) => void;
}

const Account: React.FC<AccountProps> = ({
  setIsCreditsInsufficient,
  credential,
  apiKey,
  onSignIn,
  changeKey,
}) => {
  const { balance } = useBalance();
  const { openPricing } = useBalanceRecovery(credential, balance <= 0);

  const isOAuth = credential?.kind === "oauth";

  useEffect(() => {
    sendMessageToSandBox(true, "", TYPE_GET_BALANCE);
    setIsCreditsInsufficient(balance <= 0);
  }, [credential?.token]);

  return (
    <div className="account-container">
      <div className="balance-text">
        <span className="text">{ACCOUNT_MODE_LABEL}</span>
        <span className="credits-text">
          {isOAuth ? ACCOUNT_MODE_OAUTH : ACCOUNT_MODE_API_KEY}
        </span>
      </div>
      <div className="balance-text">
        <span className="text">Account current balance</span>
        <span className="credits-text">{balance} credits</span>
      </div>
      {isOAuth && apiKey && <span className="text">{ACCOUNT_KEY_RETAINED}</span>}
      <Button type={BtnType.BUY_MORE} cb={openPricing} tabIndex={0} />
      {isOAuth ? (
        <Button type={BtnType.SIGN_OUT} cb={requestSignOut} tabIndex={0} />
      ) : (
        <Button type={BtnType.SIGN_IN} cb={onSignIn} tabIndex={0} />
      )}
      <ChangeAPIkey changeKey={changeKey} hasStoredKey={!!apiKey} />
    </div>
  );
};

export default Account;
