"use client";

type UsageItem = {
    label: string;
    current: number;
    limit: string;
    progress: number;
    tone: "calories" | "coach";
};

type ProfileUsageCardProps = {
    title: string;
    hint: string;
    items: UsageItem[];
};

export default function ProfileUsageCard({ title, hint, items }: ProfileUsageCardProps) {
    return (
        <section className="glass-panel profile-section-card profile-section-card--usage">
            <div className="profile-section-copy">
                <p className="profile-section-eyebrow">{title}</p>
                <p className="profile-section-hint">{hint}</p>
            </div>

            <div className="profile-usage-list">
                {items.map((item) => (
                    <article key={item.label} className="profile-usage-item">
                        <div className="profile-usage-top">
                            <span className="profile-usage-label">{item.label}</span>
                            <span className="profile-usage-value">
                                {item.current} / {item.limit}
                            </span>
                        </div>
                        <div className="profile-usage-track">
                            <span className={`profile-usage-fill profile-usage-fill--${item.tone}`} style={{ width: `${item.progress}%` }} />
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
