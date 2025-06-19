import React, { 
    createContext, 
    useContext, 
    useState, 
    ReactNode, 
} from 'react';

interface IBalance {
    balance: number;
    setBalance: (cb: (balance: number) => number) => void;
}

const BalanceContext: React.Context<IBalance> = createContext<IBalance>({
    balance: 0,
    setBalance: () => {},
});

export const BalanceProvider = ( { children }: { children: ReactNode } ) => {
    const [balance, setBalance] = useState<number>(0);

    return (
        <BalanceContext.Provider value={{
            balance,
            setBalance
        }}>
            { children }
        </BalanceContext.Provider>
    );
}

export const useBalance = () => {
    const context: IBalance = useContext<IBalance>(BalanceContext);
    if (!context) {
        throw new Error('useBalance must be used within a BalanceProvider');
    }
    return context;
}