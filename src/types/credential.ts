export type CredentialKind = "apikey" | "oauth";

export interface CredentialDescriptor {
    kind: CredentialKind;
    token: string;
    scopes?: readonly string[];
    expiresAt?: number;
    refreshed?: boolean;
}

export type CredentialInput = string | CredentialDescriptor;

export type TokenFailure =
    | "wrong-key"
    | "session-expired"
    | "missing-scope"
    | "bearer-rejected";
