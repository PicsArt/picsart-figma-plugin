import { NO_CREDENTIAL_IDENTITY } from "./credentialIdentity";

export default class CustomSessionStorage {
    private static sessionStorage?: CustomSessionStorage;
    private balance: number;
    private identity: string;
    private isCurrentSession: boolean;

    private constructor() {
        this.balance = 0;
        this.identity = NO_CREDENTIAL_IDENTITY;
        this.isCurrentSession = false;
    }

    static getInstance(): CustomSessionStorage {
        if (!CustomSessionStorage.sessionStorage) {
            CustomSessionStorage.sessionStorage = new CustomSessionStorage();
        }
        return CustomSessionStorage.sessionStorage;
    }

    public setBalance(incomingBalance: number, identity: string): void {
        if (identity !== this.identity) this.isCurrentSession = false;
        this.identity = identity;
        this.balance = incomingBalance;
    }

    public balanceFor(identity: string): number | undefined {
        return identity === this.identity ? this.balance : undefined;
    }

    public isWarmFor(identity: string): boolean {
        return this.isCurrentSession && identity === this.identity;
    }

    public markWarm(identity: string): void {
        if (identity === this.identity) this.isCurrentSession = true;
    }

    public reset(): void {
        this.balance = 0;
        this.identity = NO_CREDENTIAL_IDENTITY;
        this.isCurrentSession = false;
    }
}
