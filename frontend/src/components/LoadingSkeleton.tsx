"use client";

type SkeletonProps = {
    variant?: "ring" | "card" | "listItem" | "stat" | "chart" | "playerCard";
    count?: number;
};

function ShimmerBlock({ width, height, borderRadius = "12px", style }: { width: string; height: string; borderRadius?: string; style?: React.CSSProperties }) {
    return (
        <div
            className="skeleton-shimmer"
            style={{
                width,
                height,
                borderRadius,
                background: "rgba(255,255,255,0.04)",
                position: "relative",
                overflow: "hidden",
                ...style,
            }}
        />
    );
}

export function SkeletonRing() {
    return (
        <div className="glass-panel cal-card" style={{ alignItems: "center", padding: "32px" }}>
            <ShimmerBlock width="160px" height="160px" borderRadius="50%" style={{ margin: "10px 0 20px" }} />
            <ShimmerBlock width="120px" height="20px" style={{ marginBottom: "12px" }} />
            <div style={{ display: "flex", gap: "32px" }}>
                <ShimmerBlock width="60px" height="40px" />
                <ShimmerBlock width="60px" height="40px" />
            </div>
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div className="glass-panel" style={{ padding: "24px" }}>
            <ShimmerBlock width="40%" height="16px" style={{ marginBottom: "16px" }} />
            <ShimmerBlock width="100%" height="12px" borderRadius="6px" style={{ marginBottom: "12px" }} />
            <ShimmerBlock width="30%" height="14px" />
        </div>
    );
}

export function SkeletonListItem() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px",
                background: "rgba(20, 20, 20, 0.4)",
                border: "1px solid var(--panel-border)",
                borderRadius: "20px",
            }}
        >
            <div style={{ flex: 1 }}>
                <ShimmerBlock width="65%" height="16px" style={{ marginBottom: "8px" }} />
                <ShimmerBlock width="40%" height="12px" />
            </div>
            <ShimmerBlock width="32px" height="32px" borderRadius="8px" />
        </div>
    );
}

export function SkeletonStat() {
    return (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
                <ShimmerBlock width="60px" height="12px" style={{ marginBottom: "8px" }} />
                <ShimmerBlock width="80px" height="24px" />
            </div>
            <ShimmerBlock width="40px" height="40px" borderRadius="12px" />
        </div>
    );
}

export function SkeletonChart() {
    return (
        <div className="glass-panel chart-panel" style={{ height: '320px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <ShimmerBlock width="80px" height="10px" style={{ marginBottom: '8px' }} />
                    <ShimmerBlock width="160px" height="18px" style={{ marginBottom: '6px' }} />
                    <ShimmerBlock width="120px" height="12px" />
                </div>
                <ShimmerBlock width="80px" height="40px" borderRadius="10px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: 'calc(100% - 80px)' }}>
                {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '100%' }}>
                        {[...Array(7)].map((_, j) => (
                            <ShimmerBlock 
                                key={j} 
                                width="100%" 
                                height={`${30 + Math.random() * 60}%`} 
                                borderRadius="6px 6px 2px 2px"
                                style={{ flex: 1 }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SkeletonPlayerCard() {
    return (
        <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', justifyContent: 'center' }}>
                <ShimmerBlock width="100px" height="40px" borderRadius="10px" />
                <ShimmerBlock width="120px" height="24px" borderRadius="6px" />
            </div>
            <ShimmerBlock width="280px" height="280px" borderRadius="20px" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', width: '100%', maxWidth: '280px' }}>
                {[...Array(6)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <ShimmerBlock width="40px" height="40px" borderRadius="10px" />
                        <ShimmerBlock width="30px" height="10px" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function LoadingSkeleton({ variant = "card", count = 1 }: SkeletonProps) {
    const items = Array.from({ length: count });

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {items.map((_, i) => {
                switch (variant) {
                    case "ring": return <SkeletonRing key={i} />;
                    case "listItem": return <SkeletonListItem key={i} />;
                    case "stat": return <SkeletonStat key={i} />;
                    case "chart": return <SkeletonChart key={i} />;
                    case "playerCard": return <SkeletonPlayerCard key={i} />;
                    default: return <SkeletonCard key={i} />;
                }
            })}
        </div>
    );
}
