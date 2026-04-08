"use client";

import type { OnboardingGoals, OnboardingObjectiveOption, OnboardingProfile } from "./types";

function ObjectiveIcon({ icon }: { icon: OnboardingObjectiveOption["icon"] }) {
    const sharedProps = {
        width: 20,
        height: 20,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    switch (icon) {
        case "lose-fat":
            return (
                <svg {...sharedProps}>
                    <path d="M6 7c2.5-2 9.5-2 12 0" />
                    <path d="M7 12h10" />
                    <path d="m10 15 2 2 2-2" />
                </svg>
            );
        case "lose-weight":
            return (
                <svg {...sharedProps}>
                    <path d="M12 4v14" />
                    <path d="m7 13 5 5 5-5" />
                    <path d="M7 7h10" />
                </svg>
            );
        case "gain-weight":
            return (
                <svg {...sharedProps}>
                    <path d="M12 20V6" />
                    <path d="m7 11 5-5 5 5" />
                    <path d="M7 17h10" />
                </svg>
            );
        case "build-muscle":
            return (
                <svg {...sharedProps}>
                    <path d="M8 13c0-2 1.5-3.5 3.5-3.5H14" />
                    <path d="M14 9V6l4 4-4 4v-3" />
                    <path d="M6 18c1.5-2 3.5-3 6-3h3" />
                </svg>
            );
        case "maintain":
            return (
                <svg {...sharedProps}>
                    <path d="M6 12h12" />
                    <path d="M8 8h8" />
                    <path d="M8 16h8" />
                </svg>
            );
        case "neutral":
        default:
            return (
                <svg {...sharedProps}>
                    <circle cx="12" cy="12" r="7" />
                    <path d="M9 12h6" />
                </svg>
            );
    }
}

type OnboardingTargetsStepProps = {
    stepKicker: string;
    title: string;
    description: string;
    profile: OnboardingProfile;
    goals: OnboardingGoals;
    objectiveOptions: OnboardingObjectiveOption[];
    aiExplanation: string;
    isAiGenerating: boolean;
    isSaving: boolean;
    labels: {
        aiContextTitle: string;
        aiContextDesc: string;
        aiContextPlaceholder: string;
        healthObjective: string;
        dailyTargets: string;
        targetsHelp: string;
        aiButton: string;
        aiSuggesting: string;
        aiExplanation: string;
        calorieGoal: string;
        protein: string;
        carbs: string;
        fat: string;
        unitKcal: string;
        unitG: string;
        back: string;
        save: string;
        saving: string;
    };
    onProfileChange: (profile: OnboardingProfile) => void;
    onGoalsChange: (goals: OnboardingGoals) => void;
    onBack: () => void;
    onSuggestAi: () => void;
    onComplete: () => void;
};

export default function OnboardingTargetsStep({
    stepKicker,
    title,
    description,
    profile,
    goals,
    objectiveOptions,
    aiExplanation,
    isAiGenerating,
    isSaving,
    labels,
    onProfileChange,
    onGoalsChange,
    onBack,
    onSuggestAi,
    onComplete,
}: OnboardingTargetsStepProps) {
    return (
        <div className="onboarding-step">
            <div className="onboarding-step-header">
                <div className="onboarding-step-icon onboarding-step-icon--targets">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                </div>
                <div>
                    <div className="onboarding-step-kicker">{stepKicker}</div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </div>

            <div className="onboarding-stack">
                <div className="onboarding-editor-card">
                    <label className="onboarding-editor-label">{labels.aiContextTitle}</label>
                    <p className="onboarding-editor-help">{labels.aiContextDesc}</p>
                    <textarea
                        value={profile.longTermContext}
                        onChange={(e) => onProfileChange({ ...profile, longTermContext: e.target.value })}
                        placeholder={labels.aiContextPlaceholder}
                    />
                </div>

                <div className="onboarding-objective-card">
                    <label className="onboarding-editor-label">{labels.healthObjective}</label>
                    <div className="onboarding-objective-grid">
                        {objectiveOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`onboarding-objective-btn ${goals.objective === option.value ? "is-active" : ""}`}
                                onClick={() => onGoalsChange({ ...goals, objective: option.value })}
                            >
                                <span className="onboarding-objective-icon" aria-hidden="true">
                                    <ObjectiveIcon icon={option.icon} />
                                </span>
                                <span className="onboarding-objective-label">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="onboarding-targets-card">
                    <div className="onboarding-targets-header">
                        <div>
                            <label className="onboarding-editor-label">{labels.dailyTargets}</label>
                            <p className="onboarding-editor-help">{labels.targetsHelp}</p>
                        </div>
                        <button className="glass-btn onboarding-ai-btn" onClick={onSuggestAi} disabled={isAiGenerating}>
                            {isAiGenerating ? labels.aiSuggesting : labels.aiButton}
                        </button>
                    </div>

                    {aiExplanation && (
                        <div className="onboarding-ai-note">
                            <div className="onboarding-ai-note-kicker">{labels.aiExplanation}</div>
                            <p>{aiExplanation}</p>
                        </div>
                    )}

                    <div className="onboarding-field onboarding-field--full onboarding-field--unit">
                        <label>{labels.calorieGoal}</label>
                        <input
                            type="number"
                            value={goals.calories || ""}
                            onChange={(e) => onGoalsChange({ ...goals, calories: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                        />
                        <span>{labels.unitKcal}</span>
                    </div>

                    <div className="onboarding-macro-grid">
                        <div className="onboarding-field onboarding-field--unit onboarding-field--protein">
                            <label>{labels.protein}</label>
                            <input
                                type="number"
                                value={goals.protein || ""}
                                onChange={(e) => onGoalsChange({ ...goals, protein: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                            />
                            <span>{labels.unitG}</span>
                        </div>
                        <div className="onboarding-field onboarding-field--unit onboarding-field--carbs">
                            <label>{labels.carbs}</label>
                            <input
                                type="number"
                                value={goals.carbs || ""}
                                onChange={(e) => onGoalsChange({ ...goals, carbs: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                            />
                            <span>{labels.unitG}</span>
                        </div>
                        <div className="onboarding-field onboarding-field--unit onboarding-field--fat">
                            <label>{labels.fat}</label>
                            <input
                                type="number"
                                value={goals.fat || ""}
                                onChange={(e) => onGoalsChange({ ...goals, fat: e.target.value === "" ? 0 : parseInt(e.target.value, 10) })}
                            />
                            <span>{labels.unitG}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="onboarding-actions">
                <button className="glass-btn onboarding-secondary-btn" onClick={onBack}>
                    {labels.back}
                </button>
                <button className="primary-btn onboarding-primary-btn" onClick={onComplete} disabled={isSaving}>
                    {isSaving ? <span className="loading-dots">{labels.saving}</span> : labels.save}
                </button>
            </div>
        </div>
    );
}
