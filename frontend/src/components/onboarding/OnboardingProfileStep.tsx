"use client";

import type { OnboardingProfile } from "./types";

type OnboardingProfileStepProps = {
    stepKicker: string;
    title: string;
    description: string;
    profile: OnboardingProfile;
    labels: {
        name: string;
        age: string;
        sex: string;
        weight: string;
        height: string;
        male: string;
        female: string;
        other: string;
        unitKg: string;
        unitCm: string;
        back: string;
        next: string;
    };
    namePlaceholder: string;
    onProfileChange: (profile: OnboardingProfile) => void;
    onBack: () => void;
    onContinue: () => void;
};

export default function OnboardingProfileStep({
    stepKicker,
    title,
    description,
    profile,
    labels,
    namePlaceholder,
    onProfileChange,
    onBack,
    onContinue,
}: OnboardingProfileStepProps) {
    return (
        <div className="onboarding-step">
            <div className="onboarding-step-header">
                <div className="onboarding-step-icon onboarding-step-icon--profile">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </div>
                <div>
                    <div className="onboarding-step-kicker">{stepKicker}</div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </div>

            <div className="onboarding-form-grid">
                <div className="onboarding-field onboarding-field--full">
                    <label>{labels.name}</label>
                    <input
                        type="text"
                        placeholder={namePlaceholder}
                        value={profile.name}
                        onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
                    />
                </div>
                <div className="onboarding-field">
                    <label>{labels.age}</label>
                    <input
                        type="number"
                        value={profile.age || ""}
                        onChange={(e) => onProfileChange({ ...profile, age: e.target.value === "" ? 0 : parseInt(e.target.value) })}
                    />
                </div>
                <div className="onboarding-field">
                    <label>{labels.sex}</label>
                    <select
                        value={profile.sex}
                        onChange={(e) => onProfileChange({ ...profile, sex: e.target.value })}
                    >
                        <option value="male">{labels.male}</option>
                        <option value="female">{labels.female}</option>
                        <option value="other">{labels.other}</option>
                    </select>
                </div>
                <div className="onboarding-field onboarding-field--unit">
                    <label>{labels.weight}</label>
                    <input
                        type="number"
                        value={profile.weight || ""}
                        onChange={(e) => onProfileChange({ ...profile, weight: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    />
                    <span>{labels.unitKg}</span>
                </div>
                <div className="onboarding-field onboarding-field--unit">
                    <label>{labels.height}</label>
                    <input
                        type="number"
                        value={profile.height || ""}
                        onChange={(e) => onProfileChange({ ...profile, height: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    />
                    <span>{labels.unitCm}</span>
                </div>
            </div>

            <div className="onboarding-actions">
                <button className="glass-btn onboarding-secondary-btn" onClick={onBack}>
                    {labels.back}
                </button>
                <button className="primary-btn onboarding-primary-btn" onClick={onContinue}>
                    {labels.next}
                </button>
            </div>
        </div>
    );
}
