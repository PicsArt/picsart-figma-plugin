import type { CredentialDescriptor } from "@app-types/credential";

export const NO_CREDENTIAL_IDENTITY = "none";

const fnv1a32 = (input: string): string => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
};

export const credentialIdentity = (credential?: CredentialDescriptor): string =>
    credential && credential.token
        ? `${credential.kind}:${fnv1a32(credential.token)}`
        : NO_CREDENTIAL_IDENTITY;

export const apiKeyIdentity = (key?: string): string =>
    credentialIdentity(key ? { kind: "apikey", token: key } : undefined);

export default credentialIdentity;
