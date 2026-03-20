"use client";

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
    undoCallback?: () => void;
    undoDurationMs?: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showUndoToast: (message: string, undoCallback: () => void, timeoutMs?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timerRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timerRefs.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timerRefs.current.delete(id);
        }
    }, []);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        const timer = setTimeout(() => removeToast(id), 3000);
        timerRefs.current.set(id, timer);
    }, [removeToast]);

    const showUndoToast = useCallback((message: string, undoCallback: () => void, timeoutMs: number = 5000) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type: "info", undoCallback, undoDurationMs: timeoutMs }]);
        const timer = setTimeout(() => removeToast(id), timeoutMs);
        timerRefs.current.set(id, timer);
    }, [removeToast]);

    const handleUndo = (toast: Toast) => {
        if (toast.undoCallback) toast.undoCallback();
        removeToast(toast.id);
    };

    return (
        <ToastContext.Provider value={{ showToast, showUndoToast }}>
            {children}
            <div
                style={{
                    position: "fixed",
                    top: "24px",
                    right: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    zIndex: 9999,
                    pointerEvents: "none",
                    maxWidth: "380px",
                }}
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        style={{
                            background: toast.type === "error"
                                ? "linear-gradient(135deg, #966e6e, #c25050)"
                                : toast.undoCallback
                                    ? "linear-gradient(135deg, rgba(22, 28, 26, 0.95), rgba(30, 36, 34, 0.95))"
                                    : "linear-gradient(135deg, #6e9682, #4a7562)",
                            color: "white",
                            borderRadius: "14px",
                            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.8)",
                            fontSize: "14px",
                            fontWeight: 600,
                            animation: "toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                            pointerEvents: "auto",
                            overflow: "hidden",
                            border: toast.undoCallback ? "1px solid var(--panel-border)" : "none",
                        }}
                    >
                        <div style={{
                            padding: "14px 20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                        }}>
                            {toast.type === "success" && !toast.undoCallback && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            )}
                            {toast.type === "error" && (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            )}
                            <span style={{ flex: 1 }}>{toast.message}</span>
                            {toast.undoCallback && (
                                <button
                                    onClick={() => handleUndo(toast)}
                                    style={{
                                        background: "none",
                                        border: "1px solid var(--accent-cal)",
                                        color: "var(--accent-cal)",
                                        padding: "4px 14px",
                                        borderRadius: "8px",
                                        fontSize: "12px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.5px",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Undo
                                </button>
                            )}
                        </div>
                        {toast.undoCallback && toast.undoDurationMs && (
                            <div
                                className="undo-countdown-bar"
                                style={{ animationDuration: `${toast.undoDurationMs}ms` }}
                            />
                        )}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
