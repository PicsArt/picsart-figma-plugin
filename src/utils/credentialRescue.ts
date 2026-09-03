import { isRefreshableTokenFailure } from "@api/apiError";
import type { CredentialInput, TokenFailure } from "@app-types/credential";

export interface CredentialRescue {
    credential: () => CredentialInput | undefined;
    refresh: () => Promise<boolean>;
    fallback: CredentialInput;
};

const isRefreshable = (result: unknown): boolean => {
    const failure = result as { success?: unknown; tokenFailure?: TokenFailure } | null;
    if (!failure || failure.success !== false) return false;
    return !!failure.tokenFailure && isRefreshableTokenFailure(failure.tokenFailure);
};

export const withCredentialRescue = async <T>(
    call: (credential: CredentialInput) => Promise<T>,
    rescue: CredentialRescue
): Promise<T> => {
    const first = await call(rescue.credential() ?? rescue.fallback);
    if (!isRefreshable(first)) return first;

    if (!(await rescue.refresh())) return first;

    return await call(rescue.credential() ?? rescue.fallback);
};

export default withCredentialRescue;
