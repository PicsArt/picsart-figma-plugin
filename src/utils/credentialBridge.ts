import { sendMessageToSandBox } from "@api/index";
import {
  TYPE_AUTH_RESPONSE,
  TYPE_CANCEL_SIGN_IN,
  TYPE_CREDENTIAL,
  TYPE_REFRESH_CREDENTIAL,
  TYPE_SIGN_IN,
  TYPE_SIGN_OUT,
} from "@constants/index";
import type { CredentialMessage } from "@app-types/auth";
import type { CredentialDescriptor } from "@app-types/credential";

export const requestSignIn = () => sendMessageToSandBox(true, "", TYPE_SIGN_IN);

export const submitAuthResponse = (raw: string) =>
  sendMessageToSandBox(true, raw, TYPE_AUTH_RESPONSE);

export const cancelSignIn = () => sendMessageToSandBox(true, "", TYPE_CANCEL_SIGN_IN);

export const requestSignOut = () => sendMessageToSandBox(true, "", TYPE_SIGN_OUT);

const REFRESH_TIMEOUT_MS = 20000;

let nextRequestId = 0;

export const requestCredentialRefresh = (): Promise<CredentialDescriptor | null> =>
  new Promise((resolve) => {
    const requestId = `cred-${++nextRequestId}`;
    let settled = false;

    const settle = (credential: CredentialDescriptor | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(credential);
    };

    const onMessage = ({ data: { pluginMessage } }: MessageEvent) => {
      if (!pluginMessage || pluginMessage.type !== TYPE_CREDENTIAL) return;
      const reply = pluginMessage as CredentialMessage;
      if (reply.requestId !== requestId) return;
      settle(reply.payload?.credential ?? null);
    };

    const timer = setTimeout(() => {
      console.warn("The sandbox did not answer a credential refresh in time.");
      settle(null);
    }, REFRESH_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    sendMessageToSandBox(true, "", TYPE_REFRESH_CREDENTIAL, undefined, { requestId });
  });

export default requestCredentialRefresh;
