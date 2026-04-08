"use client";

type ProfileMembershipCardProps = {
    title: string;
    hint: string;
    statusLabel: string;
    tierLabel: string;
    actionLabel: string;
    isPro: boolean;
    saving: boolean;
    onAction: () => void;
};

export default function ProfileMembershipCard({
    title,
    hint,
    statusLabel,
    tierLabel,
    actionLabel,
    isPro,
    saving,
    onAction,
}: ProfileMembershipCardProps) {
    return (
        <section className={`glass-panel profile-section-card profile-membership-card ${isPro ? "is-pro" : ""}`}>
            <div className="profile-section-copy">
                <p className="profile-section-eyebrow">{title}</p>
                <p className="profile-section-hint">{hint}</p>
            </div>

            <div className="profile-membership-body">
                <div>
                    <p className="profile-membership-status">{statusLabel}</p>
                    <h3 className="profile-membership-tier">{tierLabel}</h3>
                </div>

                <button
                    type="button"
                    className={`profile-membership-action ${isPro ? "is-secondary" : "is-primary"}`}
                    onClick={onAction}
                    disabled={saving}
                >
                    {actionLabel}
                </button>
            </div>
        </section>
    );
}
