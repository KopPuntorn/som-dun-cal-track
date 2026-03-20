"use client";

import { useEffect } from "react";

type ConfirmModalProps = {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "default";
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmModal({
    isOpen,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const dangerGradient = "linear-gradient(135deg, #966e6e, #c25050)";
    const defaultGradient = "var(--accent-cal-gradient)";

    return (
        <div
            className="modal-overlay"
            onClick={onCancel}
            style={{ alignItems: "center", zIndex: 9999 }}
        >
            <div
                className="glass-panel modal-content"
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: "380px",
                    padding: "32px",
                    textAlign: "center",
                    animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                }}
            >
                {/* Icon */}
                <div
                    style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "16px",
                        background: variant === "danger" ? "rgba(150, 110, 110, 0.15)" : "rgba(130, 166, 125, 0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 20px",
                    }}
                >
                    {variant === "danger" ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c25050" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    )}
                </div>

                <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px", color: "var(--text-primary)" }}>
                    {title}
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "28px", lineHeight: 1.5 }}>
                    {message}
                </p>

                <div style={{ display: "flex", gap: "12px" }}>
                    <button
                        className="glass-btn"
                        onClick={onCancel}
                        style={{ flex: 1, height: "48px", borderRadius: "14px", fontWeight: 600 }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            height: "48px",
                            borderRadius: "14px",
                            fontWeight: 700,
                            border: "none",
                            color: "#fff",
                            background: variant === "danger" ? dangerGradient : defaultGradient,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
