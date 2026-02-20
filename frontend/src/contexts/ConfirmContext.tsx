import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import './Confirm.css';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
}

interface ConfirmContextProps {
    confirm: (options: ConfirmOptions) => void;
}

const ConfirmContext = createContext<ConfirmContextProps | undefined>(undefined);

export const useConfirm = () => {
    const context = useContext(ConfirmContext);
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider');
    }
    return context;
};

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        setConfirmState(options);
    }, []);

    const handleConfirm = () => {
        if (confirmState) {
            confirmState.onConfirm();
            setConfirmState(null);
        }
    };

    const handleCancel = () => {
        setConfirmState(null);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {confirmState && (
                <div className="confirm-overlay">
                    <div className="confirm-dialog">
                        <h3>{confirmState.title}</h3>
                        <p>{confirmState.message}</p>
                        <div className="confirm-actions">
                            <button className="btn btn-cancel" onClick={handleCancel}>
                                {confirmState.cancelText || 'Cancel'}
                            </button>
                            <button className="btn btn-danger" onClick={handleConfirm}>
                                {confirmState.confirmText || 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
};
