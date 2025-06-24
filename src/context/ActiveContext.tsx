import React, { 
    createContext, 
    useContext, 
    useState, 
    ReactNode, 
} from 'react';

interface IActive {
    isActive: boolean;
    setIsActive: (cb: (isActive: boolean) => boolean) => void;
}

const ActiveContext: React.Context<IActive> = createContext<IActive>({
    isActive: false,
    setIsActive: () => {},
});

export const ActiveProvider = ( { children }: { children: ReactNode } ) => {
    const [isActive, setIsActive] = useState<boolean>(false);

    return (
        <ActiveContext.Provider value={{
            isActive,
            setIsActive
        }}>
            { children }
        </ActiveContext.Provider>
    );
}

export const useActive = () => {
    const context: IActive = useContext<IActive>(ActiveContext);
    if (!context) {
        throw new Error('useActive must be used within a ActiveProvider');
    }
    return context;
}