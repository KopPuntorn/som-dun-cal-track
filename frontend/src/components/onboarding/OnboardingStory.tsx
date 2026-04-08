"use client";

import type { OnboardingStepCard } from "./types";

type OnboardingStoryProps = {
    badge: string;
    title: string;
    description: string;
    progressLabel: string;
    currentStep: number;
    totalSteps: number;
    completionPercent: number;
    stepCards: OnboardingStepCard[];
};

export default function OnboardingStory({
    badge,
    title,
    description,
    progressLabel,
    currentStep,
    totalSteps,
    completionPercent,
    stepCards,
}: OnboardingStoryProps) {
    return (
        <aside className="glass-panel onboarding-story">
            <div className="onboarding-story-badge">{badge}</div>
            <div className="onboarding-story-copy">
                <h1 className="onboarding-story-title">{title}</h1>
                <p className="onboarding-story-description">{description}</p>
            </div>
            <div className="onboarding-progress-panel">
                <div className="onboarding-progress-copy">
                    <span className="onboarding-progress-kicker">{progressLabel}</span>
                    <strong>{currentStep}/{totalSteps}</strong>
                </div>
                <div
                    className="onboarding-progress-track"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={totalSteps}
                    aria-valuenow={currentStep}
                    aria-label={progressLabel}
                >
                    <span className="onboarding-progress-fill" style={{ width: `${completionPercent}%` }} />
                </div>
            </div>
            <div className="onboarding-step-list">
                {stepCards.map((card, index) => (
                    <article
                        key={card.number}
                        className={`onboarding-step-card ${currentStep - 1 === index ? "is-active" : ""} ${currentStep - 1 > index ? "is-complete" : ""}`}
                    >
                        <div className="onboarding-step-card-index">{card.number}</div>
                        <div className="onboarding-step-card-copy">
                            <h2>{card.title}</h2>
                            <p>{card.caption}</p>
                        </div>
                    </article>
                ))}
            </div>
        </aside>
    );
}
