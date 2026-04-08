"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingLanguageStep from "@/components/onboarding/OnboardingLanguageStep";
import OnboardingProfileStep from "@/components/onboarding/OnboardingProfileStep";
import OnboardingStory from "@/components/onboarding/OnboardingStory";
import OnboardingTargetsStep from "@/components/onboarding/OnboardingTargetsStep";
import type {
    OnboardingGoals,
    OnboardingObjectiveOption,
    OnboardingProfile,
    OnboardingStepCard,
} from "@/components/onboarding/types";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8080/api";

export default function OnboardingPage() {
    const { user, login, isLoading } = useAuth();
    const router = useRouter();
    const { language, setLanguage, t } = useLanguage();
    const { showToast } = useToast();

    const [step, setStep] = useState(0);
    const [profile, setProfile] = useState<OnboardingProfile>({
        name: user?.name || "",
        age: 25,
        weight: 70,
        height: 170,
        sex: "other",
        longTermContext: "",
    });
    const [goals, setGoals] = useState<OnboardingGoals>({
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 70,
        objective: "",
    });
    const [loading, setLoading] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiExplanation, setAiExplanation] = useState("");

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        } else if (!isLoading && user?.onboarded) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    useEffect(() => {
        if (user?.name && !profile.name) {
            setProfile((current) => ({ ...current, name: user.name }));
        }
    }, [user?.name, profile.name]);

    const stepCards: OnboardingStepCard[] = [
        {
            number: "01",
            title: t("chooseLanguage"),
            caption: t("onboardingLanguageCaption"),
        },
        {
            number: "02",
            title: t("biometrics"),
            caption: t("onboardingBiometricsCaption"),
        },
        {
            number: "03",
            title: t("dailyTargets"),
            caption: t("onboardingTargetsCaption"),
        },
    ];

    const objectiveOptions: OnboardingObjectiveOption[] = [
        { value: "", label: t("noObjective"), icon: "neutral" },
        { value: "lose_fat", label: t("loseFat"), icon: "lose-fat" },
        { value: "lose_weight", label: t("loseWeight"), icon: "lose-weight" },
        { value: "gain_weight", label: t("gainWeight"), icon: "gain-weight" },
        { value: "build_muscle", label: t("buildMuscle"), icon: "build-muscle" },
        { value: "maintain", label: t("maintain"), icon: "maintain" },
    ];

    const completionPercent = ((step + 1) / stepCards.length) * 100;

    const handleComplete = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");

            const profileRes = await fetch(`${API_BASE}/user`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ ...profile, onboarded: true }),
            });

            const goalsRes = await fetch(`${API_BASE}/goals`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(goals),
            });

            if (profileRes.ok && goalsRes.ok) {
                const updatedUser = await profileRes.json();
                const currentToken = localStorage.getItem("auth_token");
                if (currentToken) {
                    login(currentToken, updatedUser);
                }
                showToast(t("onboardingSaveSuccess"), "success");
                router.push("/");
            } else {
                showToast(t("onboardingSaveFailed"), "error");
            }
        } catch {
            showToast(t("onboardingNetworkError"), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAiSuggest = async () => {
        setIsAiGenerating(true);
        setAiExplanation("");
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`${API_BASE}/suggest-goals`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    age: profile.age,
                    weight: profile.weight,
                    height: profile.height,
                    sex: profile.sex,
                    objective: goals.objective,
                    language,
                }),
            });

            if (!res.ok) throw new Error("Failed to suggest goals");
            const json = await res.json();

            setGoals((current) => ({
                ...current,
                calories: json.calories,
                protein: json.protein,
                carbs: json.carbs,
                fat: json.fat,
            }));
            setAiExplanation(json.explanation);
            showToast(t("onboardingAiSuccess"), "success");
        } catch (error) {
            console.error(error);
            showToast(t("onboardingAiFailed"), "error");
        } finally {
            setIsAiGenerating(false);
        }
    };

    if (isLoading || !user) {
        return <div className="app-container">{t("loading")}</div>;
    }

    return (
        <div className="page-shell onboarding-screen">
            <div className="onboarding-shell">
                <OnboardingStory
                    badge={t("onboardingSetupBadge")}
                    title={t("welcomeName").replace("{name}", user.name)}
                    description={t("buildProfileDesc")}
                    progressLabel={t("onboardingProgressLabel")}
                    currentStep={step + 1}
                    totalSteps={stepCards.length}
                    completionPercent={completionPercent}
                    stepCards={stepCards}
                />

                <section className="glass-panel onboarding-panel">
                    {step === 0 && (
                        <OnboardingLanguageStep
                            stepKicker={t("onboardingLanguageKicker")}
                            title={t("chooseLanguage")}
                            description={t("onboardingLanguageHelp")}
                            language={language}
                            englishLabel={t("onboardingLanguageEnglish")}
                            thaiLabel={t("onboardingLanguageThai")}
                            primaryLabel={t("startOnboarding")}
                            onLanguageChange={setLanguage}
                            onContinue={() => setStep(1)}
                        />
                    )}

                    {step === 1 && (
                        <OnboardingProfileStep
                            stepKicker={t("onboardingProfileKicker")}
                            title={t("biometrics")}
                            description={t("onboardingProfileHelp")}
                            profile={profile}
                            labels={{
                                name: t("name"),
                                age: t("age"),
                                sex: t("sex"),
                                weight: t("weight"),
                                height: t("height"),
                                male: t("male"),
                                female: t("female"),
                                other: t("other"),
                                unitKg: t("unitKg"),
                                unitCm: t("unitCm"),
                                back: t("back"),
                                next: t("nextPhase"),
                            }}
                            namePlaceholder={t("onboardingNamePlaceholder")}
                            onProfileChange={setProfile}
                            onBack={() => setStep(0)}
                            onContinue={() => setStep(2)}
                        />
                    )}

                    {step === 2 && (
                        <OnboardingTargetsStep
                            stepKicker={t("onboardingTargetsKicker")}
                            title={t("dailyTargets")}
                            description={t("onboardingTargetsHelp")}
                            profile={profile}
                            goals={goals}
                            objectiveOptions={objectiveOptions}
                            aiExplanation={aiExplanation}
                            isAiGenerating={isAiGenerating}
                            isSaving={loading}
                            labels={{
                                aiContextTitle: t("aiContextTitle"),
                                aiContextDesc: t("aiContextDesc"),
                                aiContextPlaceholder: t("aiContextPlaceholder"),
                                healthObjective: t("healthObjective"),
                                dailyTargets: t("dailyTargets"),
                                targetsHelp: t("onboardingTargetsManualHelp"),
                                aiButton: t("suggestGoalsAi"),
                                aiSuggesting: t("aiSuggesting"),
                                aiExplanation: t("aiExplanation"),
                                calorieGoal: t("calorieGoal"),
                                protein: t("protein"),
                                carbs: t("carbs"),
                                fat: t("fat"),
                                unitKcal: t("unitKcal"),
                                unitG: t("unitG"),
                                back: t("back"),
                                save: t("startTracking"),
                                saving: t("saving"),
                            }}
                            onProfileChange={setProfile}
                            onGoalsChange={setGoals}
                            onBack={() => setStep(1)}
                            onSuggestAi={handleAiSuggest}
                            onComplete={handleComplete}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}

