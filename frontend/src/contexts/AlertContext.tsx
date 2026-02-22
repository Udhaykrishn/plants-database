import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import './Alert.css';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertMessage {
    id: number;
    message: string;
    type: AlertType;
}

interface AlertContextProps {
    showAlert: (message: string, type?: AlertType) => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alerts, setAlerts] = useState<AlertMessage[]>([]);

    const showAlert = useCallback((message: string, type: AlertType = 'info') => {
        const id = Date.now();
        setAlerts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setAlerts((prev) => prev.filter((alert) => alert.id !== id));
        }, 3000);
    }, []);

    const removeAlert = (id: number) => {
        setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    };

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            <div className="alert-container">
                {alerts.map((alert) => (
                    <div key={alert.id} className={`alert-toast alert-${alert.type}`}>
                        <span>{alert.message}</span>
                        <button className="alert-close" onClick={() => removeAlert(alert.id)}>&times;</button>
                    </div>
                ))}
            </div>
        </AlertContext.Provider>
    );
};
