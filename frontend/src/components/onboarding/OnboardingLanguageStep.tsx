"use client";

import type { Language } from "@/translations";

type OnboardingLanguageStepProps = {
    stepKicker: string;
    title: string;
    description: string;
    language: Language;
    englishLabel: string;
    thaiLabel: string;
    primaryLabel: string;
    onLanguageChange: (language: Language) => void;
    onContinue: () => void;
};

export default function OnboardingLanguageStep({
    stepKicker,
    title,
    description,
    language,
    englishLabel,
    thaiLabel,
    primaryLabel,
    onLanguageChange,
    onContinue,
}: OnboardingLanguageStepProps) {
    return (
        <div className="onboarding-step">
            <div className="onboarding-step-header">
                <div className="onboarding-step-icon onboarding-step-icon--language">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5h12" />
                        <path d="M10 5c0 8-4 13-6 15" />
                        <path d="M8 13h8" />
                        <path d="m14 10 5 10" />
                        <path d="m16.5 15 5-10" />
                    </svg>
                </div>
                <div>
                    <div className="onboarding-step-kicker">{stepKicker}</div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </div>

            <div className="onboarding-lang-grid">
                <button
                    type="button"
                    className={`onboarding-lang-card ${language === "en" ? "is-active" : ""}`}
                    onClick={() => onLanguageChange("en")}
                >
                    <span className="onboarding-lang-flag">EN</span>
                    <span className="onboarding-lang-label">{englishLabel}</span>
                </button>
                <button
                    type="button"
                    className={`onboarding-lang-card ${language === "th" ? "is-active" : ""}`}
                    onClick={() => onLanguageChange("th")}
                >
                    <span className="onboarding-lang-flag">TH</span>
                    <span className="onboarding-lang-label">{thaiLabel}</span>
                </button>
            </div>

            <div className="onboarding-actions onboarding-actions--single">
                <button className="primary-btn onboarding-primary-btn" onClick={onContinue}>
                    {primaryLabel}
                </button>
            </div>
        </div>
    );
}
