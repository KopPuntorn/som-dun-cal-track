"use client";

import ObjectiveIcon from "./ObjectiveIcon";

export type ProfileObjectiveOption = {
    value: string;
    label: string;
    icon: "neutral" | "lose-fat" | "lose-weight" | "gain-weight" | "build-muscle" | "maintain";
};

type ProfileObjectiveGridProps = {
    options: ProfileObjectiveOption[];
    value: string;
    onChange: (value: string) => void;
};

export default function ProfileObjectiveGrid({ options, value, onChange }: ProfileObjectiveGridProps) {
    return (
        <div className="profile-objective-grid">
            {options.map((option) => (
                <button
                    key={option.value || "none"}
                    type="button"
                    className={`profile-objective-btn ${value === option.value ? "is-active" : ""}`}
                    onClick={() => onChange(option.value)}
                >
                    <span className="profile-objective-icon" aria-hidden="true">
                        <ObjectiveIcon icon={option.icon} />
                    </span>
                    <span className="profile-objective-label">{option.label}</span>
                </button>
            ))}
        </div>
    );
}
