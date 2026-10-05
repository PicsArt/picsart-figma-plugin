import React from "react";
import { Button } from "@components/index";
import { BtnType } from "@app-types/enums";
import type { AuthState } from "@app-types/auth";
import { WIDGET_HEIGHT_SIGN_IN } from "@constants/index";
import usePluginHeight from "@hooks/usePluginHeight";
import {
  ACCOUNT_KEY_RETAINED,
  SIGN_IN_AWAITING_LEAD,
  SIGN_IN_CONFIRMED_CREDITS,
  SIGN_IN_CODE_LEAD,
  SIGN_IN_CONFIRMED_LEAD,
  SIGN_IN_POLLING_LEAD,
  SIGN_IN_ZERO_CREDITS_LEAD,
  signInCodeAt,
  signedInAs,
} from "@ui_constants/texts";
import { SIGN_IN_DECLINED_ERR } from "@constants/errorMessages";
import { cancelSignIn } from "@utils/credentialBridge";
import "./styles.scss";

interface Props {
  authState: AuthState;
  showConfirmation: boolean;
  hasApiKey: boolean;
  hasCredential: boolean;
  balance: number;
  balanceKnown: boolean;
  onDone: () => void;
  onRetry: () => void;
  onUseApiKey: () => void;
  onAddCredits: () => void;
}

const SignIn: React.FC<Props> = ({
  authState,
  showConfirmation,
  hasApiKey,
  hasCredential,
  balance,
  balanceKnown,
  onDone,
  onRetry,
  onUseApiKey,
  onAddCredits,
}) => {
  usePluginHeight(WIDGET_HEIGHT_SIGN_IN);

  const verificationUrl =
    authState.status === "awaiting"
      ? authState.verificationUriComplete ?? authState.verificationUri
      : undefined;

  const reopen = () => {
    if (verificationUrl) window.open(verificationUrl, "_blank", "noopener,noreferrer");
  };

  const status = (text: string) => (
    <p className="signin-status" role="status" aria-live="polite">
      {text}
    </p>
  );

  if (showConfirmation && authState.status === "signedIn") {
    const noCredits = balanceKnown && balance <= 0;
    return (
      <div className="signin">
        {status(noCredits ? SIGN_IN_ZERO_CREDITS_LEAD : SIGN_IN_CONFIRMED_LEAD)}
        {authState.name && <p className="signin-note">{signedInAs(authState.name)}</p>}
        {!noCredits && <p className="signin-note">{SIGN_IN_CONFIRMED_CREDITS}</p>}
        {hasApiKey && <p className="signin-note">{ACCOUNT_KEY_RETAINED}</p>}
        <div className="signin-actions">
          {noCredits && <Button type={BtnType.ADD_CREDITS} cb={onAddCredits} tabIndex={0} />}
          <Button type={BtnType.CONTINUE} cb={onDone} tabIndex={0} />
        </div>
      </div>
    );
  }

  if (authState.status === "starting" || authState.status === "working") {
    return <div className="signin">{status(SIGN_IN_POLLING_LEAD)}</div>;
  }

  if (authState.status === "awaiting") {
    return (
      <div className="signin">
        {status(SIGN_IN_AWAITING_LEAD)}
        <p className="signin-note">{SIGN_IN_CODE_LEAD}</p>
        <p className="signin-code" aria-label="Sign-in code">
          {authState.userCode}
        </p>
        <p className="signin-note">{signInCodeAt(authState.verificationUri)}</p>
        <p className="signin-note">{SIGN_IN_POLLING_LEAD}</p>
        <div className="signin-actions">
          <Button type={BtnType.REOPEN_BROWSER} cb={reopen} tabIndex={0} />
          <Button type={BtnType.CANCEL} cb={cancelSignIn} tabIndex={0} />
        </div>
      </div>
    );
  }

  const reason = authState.status === "denied" ? SIGN_IN_DECLINED_ERR : authState.status === "failed" ? authState.reason : "";

  return (
    <div className="signin">
      <p className="signin-error" role="status" aria-live="polite">
        {reason}
      </p>
      <div className="signin-actions">
        <Button type={BtnType.SIGN_IN_RETRY} cb={onRetry} tabIndex={0} />
        <Button type={BtnType.USE_API_KEY} cb={onUseApiKey} tabIndex={0} />
        {hasCredential && <Button type={BtnType.CONTINUE} cb={onDone} tabIndex={0} />}
      </div>
    </div>
  );
};

export default SignIn;
