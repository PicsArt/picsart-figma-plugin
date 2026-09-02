import {
    BALANACE,
    BALANCE_UNAVAILABLE_ERR,
    PICSARTURL,
} from "@constants/index";
import type { CredentialInput } from "@app-types/credential";
import { asCredential, customFetch } from "./customFetch";
import {
    classifyTokenFailure,
    isTokenError,
    readApiText,
    readJsonBody,
    tokenFailureMessage,
} from "./apiError";

interface BalanceResponse {
    message?: string;
    credits?: number;
}

export const getBalance = async (key: CredentialInput) : Promise<GetBalanceReturnType> => {
    try {
        const credential = asCredential(key);
        const response = await customFetch(PICSARTURL + BALANACE, { credential });
        const res = (await readJsonBody(response)) as BalanceResponse | null;

        if (!response.ok || isTokenError(response.status, res)) {
            return {
                success: false,
                msg: isTokenError(response.status, res)
                    ? tokenFailureMessage(classifyTokenFailure(credential))
                    : readApiText(res) || BALANCE_UNAVAILABLE_ERR,
            };
        }

        if (typeof res?.credits !== "number" || !isFinite(res.credits)) {
            console.warn("Balance response carried no numeric credits field:", res);
            return { success: false, msg: BALANCE_UNAVAILABLE_ERR };
        }

        return { success: true, msg: res.credits };
    } catch (error) {
        console.error("Error reading the credit balance:", error);
        return { success: false, msg: BALANCE_UNAVAILABLE_ERR };
    }
};

export default getBalance;
