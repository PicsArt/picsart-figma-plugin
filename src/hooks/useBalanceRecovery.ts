import { useCallback, useEffect, useRef } from "react";
import { refreshBalance } from "@api/index";
import { PRICING } from "@constants/url";
import type { CredentialInput } from "@app-types/credential";

const useBalanceRecovery = (
  key: CredentialInput | null | undefined,
  isCreditsInsufficient: boolean
): { openPricing: () => void; recheck: () => void } => {
  const inFlight = useRef(false);
  const awaitingTopUp = useRef(false);
  const blocked = useRef(isCreditsInsufficient);
  blocked.current = isCreditsInsufficient;

  const recheck = useCallback(() => {
    if (!key || inFlight.current) return;
    inFlight.current = true;
    refreshBalance(key)
      .catch((error) => console.error("Couldn't re-read the credit balance:", error))
      .finally(() => {
        inFlight.current = false;
      });
  }, [key]);

  const openPricing = useCallback(() => {
    awaitingTopUp.current = true;
    recheck();
    window.open(PRICING, "_blank");
  }, [recheck]);

  useEffect(() => {
    const onReturn = () => {
      if (!awaitingTopUp.current && !blocked.current) return;
      awaitingTopUp.current = false;
      recheck();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") onReturn();
    };

    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [recheck]);

  return { openPricing, recheck };
};

export default useBalanceRecovery;
