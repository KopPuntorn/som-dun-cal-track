"use client";

type ObjectiveIconName = "neutral" | "lose-fat" | "lose-weight" | "gain-weight" | "build-muscle" | "maintain";

export default function ObjectiveIcon({ icon }: { icon: ObjectiveIconName }) {
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
