"use client";

type ErrorStateProps = {
    title?: string;
    message?: string;
    onRetry?: () => void;
    retryLabel?: string;
    onSecondaryAction?: () => void;
    secondaryLabel?: string;
};

export default function ErrorState({
    title = "Connection Error",
    message = "Something went wrong",
    onRetry,
    retryLabel = "Try Again",
    onSecondaryAction,
    secondaryLabel = "Enter Manually",
}: ErrorStateProps) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            textAlign: "center",
            animation: "fadeIn 0.5s ease",
        }}>
            <div style={{
                width: "64px",
                height: "64px",
                borderRadius: "20px",
                background: "rgba(150, 110, 110, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "20px",
            }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h4 style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
            }}>
                {title}
            </h4>
            <p style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                maxWidth: "300px",
                lineHeight: 1.5,
                marginBottom: (onRetry || onSecondaryAction) ? "24px" : "0",
            }}>
                {message}
            </p>
            {(onRetry || onSecondaryAction) && (
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="glass-btn"
                            style={{
                                padding: "12px 28px",
                                borderRadius: "14px",
                                fontWeight: 700,
                                fontSize: "14px",
                                color: "var(--accent-cal)",
                                border: "1px solid var(--accent-cal)",
                                background: "rgba(130, 166, 125, 0.1)",
                                gap: "8px",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                            </svg>
                            {retryLabel}
                        </button>
                    )}
                    {onSecondaryAction && (
                        <button
                            onClick={onSecondaryAction}
                            className="glass-btn"
                            style={{
                                padding: "12px 20px",
                                borderRadius: "14px",
                                fontWeight: 600,
                                fontSize: "14px",
                                color: "var(--text-secondary)",
                                gap: "8px",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                            {secondaryLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
