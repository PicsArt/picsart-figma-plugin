/**
 * CustomSessionStorage is a singleton class that simulates sessionStorage
 * for storing the user's balance during a single session of the Figma plugin.
 * Since Figma does not support sessionStorage, this class provides a single instance
 * to persist balance data until the plugin is reloaded.
 */


export default class CustomSessionStorage {
    private static sessionStorage?: CustomSessionStorage;
    private balance: number;
    private isCurrentSession: boolean;

    private constructor() {
        this.balance = 0;
        this.isCurrentSession = false;
    }

    static getInstance(): CustomSessionStorage {
        if (!CustomSessionStorage.sessionStorage) {
            CustomSessionStorage.sessionStorage = new CustomSessionStorage();
        }
        return CustomSessionStorage.sessionStorage;
    }

    public setBalance(incomingBalance: number): void {
        this.balance = incomingBalance;
    }

    public getBalance(): number {
        return this.balance;
    }

    public setCurrentSession() {
        this.isCurrentSession = true;
    }

    public getCurrentSession() {
        return this.isCurrentSession;
    }
}

const sessionStorage: CustomSessionStorage = CustomSessionStorage.getInstance();
sessionStorage.getBalance();