export type OnboardingStepCard = {
    number: string;
    title: string;
    caption: string;
};

export type OnboardingProfile = {
    name: string;
    age: number;
    weight: number;
    height: number;
    sex: string;
    longTermContext: string;
};

export type OnboardingGoals = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    objective: string;
};

export type OnboardingObjectiveOption = {
    value: string;
    label: string;
    icon: "neutral" | "lose-fat" | "lose-weight" | "gain-weight" | "build-muscle" | "maintain";
};
