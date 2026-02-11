import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../utils/cn';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className={cn(
                                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl min-w-[300px] max-w-md",
                                "bg-zinc-950/80 backdrop-blur-xl",
                                toast.type === 'success' && "border-emerald-500/20 text-emerald-400",
                                toast.type === 'error' && "border-red-500/20 text-red-400",
                                toast.type === 'info' && "border-blue-500/20 text-blue-400"
                            )}
                        >
                            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                            {toast.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
                            {toast.type === 'info' && <Info className="h-5 w-5 shrink-0" />}

                            <span className="text-sm font-medium flex-1 text-white/90">{toast.message}</span>

                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};
