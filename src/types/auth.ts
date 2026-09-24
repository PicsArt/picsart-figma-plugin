import type { AuthRendezvousMode } from "@constants/auth";
import type { CredentialDescriptor } from "./credential";

export type AuthState =
  | { status: "idle" }
  | { status: "armed"; authorizeUrl: string }
  | { status: "starting" }
  | { status: "awaiting"; mode: AuthRendezvousMode; authorizeUrl: string }
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
