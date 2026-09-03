import type { CredentialInput } from "@app-types/credential";
import { mayReceiveCredential } from "@api/apiError";
import { asCredential, credentialHeaders } from "@api/customFetch";
import {
    HEADER_PLUGIN_NAME_KEY,
    HEADER_PLUGIN_NAME_VALUE,
} from "@constants/index";
import { authLog } from "./authLog";

export type SandboxFetchFn = (url: string, init?: FetchOptions) => Promise<FetchResponse>;

export interface SandboxRequest {
    method?: string;
    headers?: Record<string, string>;
    body?: Uint8Array | string;
    credential?: CredentialInput;
    omitAttribution?: boolean;
}

export interface SandboxFetchResult {
    ok: boolean;
    status: number;
    header: (name: string) => string | undefined;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
    error?: unknown;
}

const readHeader = (
    headers: { [name: string]: string } | undefined,
    name: string
): string | undefined => {
    if (!headers) return undefined;
    const wanted = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === wanted) return headers[key];
    }
    return undefined;
};

const failedResult = (error: unknown): SandboxFetchResult => ({
    ok: false,
    status: 0,
    header: () => undefined,
    json: async () => null,
    text: async () => "",
    error,
});

export const sandboxFetch = async (
    url: string,
    request: SandboxRequest = {},
    fetchFn: SandboxFetchFn = fetch as unknown as SandboxFetchFn
): Promise<SandboxFetchResult> => {
    const { credential, headers: callerHeaders, omitAttribution, ...rest } = request;

    const headers: Record<string, string> = {
        ...(callerHeaders ?? {}),
        ...(omitAttribution
            ? {}
            : { [HEADER_PLUGIN_NAME_KEY]: HEADER_PLUGIN_NAME_VALUE }),
    };

    if (credential) {
        if (mayReceiveCredential(url)) {
            const built = credentialHeaders(asCredential(credential));
            for (const name of Object.keys(built)) headers[name] = built[name];
        } else {
            authLog("withheld a credential from a host that may not receive one:", { url });
        }
    }

    try {
        const response = await fetchFn(url, { ...rest, headers });
        return {
            ok: response.ok,
            status: response.status,
            header: (name) => readHeader(response.headersObject, name),
            json: () => response.json(),
            text: () => response.text(),
        };
    } catch (error) {
        authLog(`request to ${url} did not complete:`, { error: String(error) });
        return failedResult(error);
    }
};

export default sandboxFetch;
