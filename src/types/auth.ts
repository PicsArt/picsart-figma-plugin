import type { CredentialDescriptor } from "./credential";

export type AuthState =
  | { status: "idle" }
  | { status: "starting" }
  | {
      status: "awaiting";
      /** Shown in the panel; the accounts page shows it back for the user to match. */
      userCode: string;
      verificationUri: string;
      verificationUriComplete?: string;
      expiresAt: number;
    }
  | { status: "working" }
  | {
      status: "signedIn";
      name?: string;
      scopes: string[];
      expiresAt: number;
    }
  | { status: "denied" }
  | { status: "failed"; reason: string };

export interface AuthStateMessage {
  type: string;
  payload: AuthState;
}

export interface CredentialMessage {
  type: string;
  payload: {
    credential: CredentialDescriptor | null;
    apiKey: string;
  };
  requestId?: string;
}
