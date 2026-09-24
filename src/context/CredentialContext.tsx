import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
    ReactNode,
} from "react";
import type { CredentialDescriptor, CredentialInput } from "@app-types/credential";
import { requestCredentialRefresh } from "@utils/credentialBridge";

interface ICredential {
    credential: CredentialDescriptor | null;
    apiKey: string;
    setActive: (credential: CredentialDescriptor | null, apiKey: string) => void;
    getCredential: () => CredentialInput | undefined;
    refreshCredential: () => Promise<boolean>;
}

const CredentialContext: React.Context<ICredential> = createContext<ICredential>({
    credential: null,
    apiKey: "",
    setActive: () => {},
    getCredential: () => undefined,
    refreshCredential: async () => false,
});

export const CredentialProvider = ({ children }: { children: ReactNode }) => {
    const [credential, setCredential] = useState<CredentialDescriptor | null>(null);
    const [apiKey, setApiKey] = useState<string>("");

    const credentialRef = useRef<CredentialDescriptor | null>(null);

    const setActive = useCallback(
        (next: CredentialDescriptor | null, nextApiKey: string) => {
            credentialRef.current = next;
            setCredential(next);
            setApiKey(nextApiKey);
        },
        []
    );

    const getCredential = useCallback(
        () => credentialRef.current ?? undefined,
        []
    );

    const refreshCredential = useCallback(async () => {
        const refreshed = await requestCredentialRefresh();
        if (!refreshed) return false;

        credentialRef.current = refreshed;
        setCredential(refreshed);

        return refreshed.kind === "oauth";
    }, []);

    return (
        <CredentialContext.Provider
            value={{ credential, apiKey, setActive, getCredential, refreshCredential }}
        >
            {children}
        </CredentialContext.Provider>
    );
};

export const useCredential = () => useContext<ICredential>(CredentialContext);

export default CredentialContext;
