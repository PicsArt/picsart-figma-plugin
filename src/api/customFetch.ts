import {
    BEARER_PREFIX,
    HEADERAPI,
    HEADER_AUTHORIZATION,
    HEADER_PLUGIN_NAME_KEY,
    HEADER_PLUGIN_NAME_VALUE,
} from "@constants/url";
import type { CredentialDescriptor } from "@app-types/credential";
import { mayReceiveCredential } from "./apiError";

type FetchProps = Omit<RequestInit, "headers"> & {
    headers?: Record<string, string>;
    credential?: string | CredentialDescriptor;
};

export const asCredential = (
    value: string | CredentialDescriptor
): CredentialDescriptor =>
    typeof value === "string" ? { kind: "apikey", token: value } : value;

export const credentialHeaders = (
    credential: CredentialDescriptor
): Record<string, string> =>
    credential.kind === "oauth"
        ? { [HEADER_AUTHORIZATION]: `${BEARER_PREFIX}${credential.token}` }
        : { [HEADERAPI]: credential.token };

const CREDENTIAL_HEADER_NAMES = [
    HEADERAPI.toLowerCase(),
    HEADER_AUTHORIZATION.toLowerCase(),
    "apikey",
    "x-app-authorization",
];

export const customFetch = async (url: string, options?: FetchProps): Promise<Response> => {
    const { credential, ...rest } = options ?? {};

    const headers: Record<string, string> = {
        ...(options?.headers ?? {}),
        ...(credential ? credentialHeaders(asCredential(credential)) : {}),
        [HEADER_PLUGIN_NAME_KEY]: HEADER_PLUGIN_NAME_VALUE,
    };

    if (!mayReceiveCredential(url)) {
        const withheld = Object.keys(headers).filter(
            (name) => CREDENTIAL_HEADER_NAMES.indexOf(name.toLowerCase()) !== -1
        );
        for (const name of withheld) delete headers[name];
        if (withheld.length > 0) {
            console.warn(
                `Withheld ${withheld.join(", ")} from a host that may not receive a credential:`,
                url
            );
        }
    }

    return await fetch(url, { ...rest, headers });
};
