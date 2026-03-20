"use client";

type EmptyStateProps = {
    icon?: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
};

export default function EmptyState({ icon = "📋", title, subtitle, actionLabel, onAction }: EmptyStateProps) {
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
                fontSize: "48px",
                marginBottom: "16px",
                filter: "grayscale(0.3)",
                animation: "floatBounce 3s ease-in-out infinite",
            }}>
                {icon}
            </div>
            <h4 style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: "8px",
            }}>
                {title}
            </h4>
            {subtitle && (
                <p style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    maxWidth: "280px",
                    lineHeight: 1.5,
                    marginBottom: actionLabel ? "20px" : "0",
                }}>
                    {subtitle}
                </p>
            )}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="glass-btn"
                    style={{
                        padding: "10px 24px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        fontSize: "13px",
                        color: "var(--accent-cal)",
                        border: "1px solid var(--accent-cal)",
                        background: "rgba(130, 166, 125, 0.1)",
                    }}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
