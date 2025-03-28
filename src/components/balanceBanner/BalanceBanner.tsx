import React, { useEffect, useState } from "react";
import { getBalance } from "@api/index";
import { PRICING } from "@constants/url";
import "./styles.scss";
import { INSUFFICIENT_CREDITS } from "@ui_constants/texts";
interface Props {
  gottenKey: string;
  updateBalance: number;
  isCreditsInsufficient: boolean;
  setIsCreditsInsufficient: (status: boolean) => void;
}

const BalanceBanner: React.FC<Props> = ({
  gottenKey,
  updateBalance,
  isCreditsInsufficient,
  setIsCreditsInsufficient,
}) => {
  const [keyBalance, setKeyBalance] = useState<number | null>(null);

  useEffect(() => {
    const getBalanceRequest = async () => {
      const response: GetBalanceReturnType = await getBalance(gottenKey);
      if (response.success) {
        if (response.msg === 0) {
          setIsCreditsInsufficient(true);
        } else {
          setIsCreditsInsufficient(false);
        }
        setKeyBalance(response.msg as number);
      } else {
        setIsCreditsInsufficient(true);
      }
    };

    getBalanceRequest();
  }, [gottenKey, updateBalance]);

  return (
    <div className="balance-container">
      <div className="text-container">
        <span className="balance-text">Balance</span>
        <span className="credits-text">
          {keyBalance} credits{" "}
          {isCreditsInsufficient && (
            <span className="error-text">{INSUFFICIENT_CREDITS}</span>
          )}
        </span>
      </div>
      <div
        className="plus-container"
        onClick={() => window.open(PRICING, "_blank")}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.5 5.5V0.5H6.5V5.5H11.5V6.5H6.5V11.5H5.5V6.5H0.5V5.5H5.5Z"
            fill="#520BE5"
          />
        </svg>
      </div>
    </div>
  );
};

export default BalanceBanner;
