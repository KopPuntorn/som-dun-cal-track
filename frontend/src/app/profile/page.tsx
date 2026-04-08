"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import PageHeader from "@/components/PageHeader";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import ProfileMembershipCard from "@/components/profile/ProfileMembershipCard";
import ProfileObjectiveGrid, { type ProfileObjectiveOption } from "@/components/profile/ProfileObjectiveGrid";
import ProfileUsageCard from "@/components/profile/ProfileUsageCard";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";

type Goals = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    objective: string;
};

type UserProfile = {
    name: string;
    age: number;
    weight: number;
    height: number;
    sex: string;
    onboarded: boolean;
    tourCompleted: boolean;
    longTermContext: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8080/api";

const fetcher = (url: string) => fetch(url, {
    headers: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
    },
}).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch data");
    return res.json();
});

export default function ProfilePage() {
    const { user: authUser, logout, isLoading: authLoading, refreshUser } = useAuth();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);

    const [goalInputs, setGoalInputs] = useState<Goals>({
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 70,
        objective: "",
    });
    const [userInputs, setUserInputs] = useState<UserProfile>({
        name: "User",
        age: 25,
        weight: 70,
        height: 170,
        sex: "other",
        onboarded: true,
        tourCompleted: false,
        longTermContext: "",
    });

    const { data: goalsData, error: goalsError } = useSWR(authLoading ? null : `${API_BASE}/goals`, fetcher);
    const { data: userData, error: userError } = useSWR(authLoading ? null : `${API_BASE}/user`, fetcher);

    useEffect(() => {
        if (goalsData) {
            setGoalInputs({
                calories: goalsData.calories || 2000,
                protein: goalsData.protein || 150,
                carbs: goalsData.carbs || 250,
                fat: goalsData.fat || 70,
                objective: goalsData.objective || "",
            });
        }
    }, [goalsData]);

    useEffect(() => {
        if (userData) {
            setUserInputs({
                name: userData.name || authUser?.name || "User",
                age: userData.age || 25,
                weight: userData.weight || 70,
                height: userData.height || 170,
                sex: userData.sex || "other",
                onboarded: userData.onboarded ?? true,
                tourCompleted: userData.tourCompleted ?? false,
                longTermContext: userData.longTermContext || "",
            });
            setLoading(false);
        }
    }, [userData, authUser]);

    useEffect(() => {
        if (goalsError || userError) {
            setError(t("profileErrorLoad"));
            setLoading(false);
        }
    }, [goalsError, userError, t]);

    useEffect(() => {
        if (authLoading) return;
        if (!authUser) {
            router.push("/login");
        }
    }, [authLoading, authUser, router]);

    const objectiveOptions: ProfileObjectiveOption[] = [
        { value: "", label: t("profileObjectiveNone"), icon: "neutral" },
        { value: "lose_fat", label: t("profileObjectiveLoseFat"), icon: "lose-fat" },
        { value: "lose_weight", label: t("profileObjectiveLoseWeight"), icon: "lose-weight" },
        { value: "gain_weight", label: t("profileObjectiveGainWeight"), icon: "gain-weight" },
        { value: "build_muscle", label: t("profileObjectiveBuildMuscle"), icon: "build-muscle" },
        { value: "maintain", label: t("profileObjectiveMaintain"), icon: "maintain" },
    ];

    const usageItems = [
        {
            label: t("profileScanCredits"),
            current: authUser?.usage?.aiScanCount || 0,
            limit: authUser?.tier === "pro" ? "INF" : "3",
            progress: authUser?.tier === "pro" ? 100 : Math.min(100, ((authUser?.usage?.aiScanCount || 0) / 3) * 100),
            tone: "calories" as const,
        },
        {
            label: t("profileChatCredits"),
            current: authUser?.usage?.aiChatCount || 0,
            limit: authUser?.tier === "pro" ? "INF" : "5",
            progress: authUser?.tier === "pro" ? 100 : Math.min(100, ((authUser?.usage?.aiChatCount || 0) / 5) * 100),
            tone: "coach" as const,
        },
    ];

    const triggerCelebration = () => {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
    };

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const token = localStorage.getItem("auth_token");
            const headers = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const [goalsRes, userRes] = await Promise.all([
                fetch(`${API_BASE}/goals`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify(goalInputs),
                }),
                fetch(`${API_BASE}/user`, {
                    method: "PUT",
                    headers,
                    body: JSON.stringify(userInputs),
                }),
            ]);

            if (!goalsRes.ok || !userRes.ok) {
                throw new Error("Failed to save settings");
            }

            showToast(t("profileSaveSuccess"), "success");
            mutate(`${API_BASE}/goals`);
            mutate(`${API_BASE}/user`);
            mutate((key: unknown) => typeof key === "string" && key.includes("/dashboard/summary"), undefined, { revalidate: true });
        } catch (err) {
            console.error(err);
            setError(t("profileSaveError"));
            showToast(t("profileSaveError"), "error");
        } finally {
            setSaving(false);
        }
    };

    const handleTierAction = async () => {
        setSaving(true);
        try {
            const endpoint = authUser?.tier === "pro" ? "mock-downgrade" : "mock-upgrade";
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`${API_BASE}/user/${endpoint}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                throw new Error("Tier update failed");
            }

            if (endpoint === "mock-upgrade") {
                triggerCelebration();
                showToast(t("profileUpgradeSuccess"), "success");
            } else {
                showToast(t("profileDowngradeSuccess"), "success");
            }

            await refreshUser?.();
        } catch (err) {
            console.error(err);
            showToast(t("profileTierActionError"), "error");
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="page-shell page-shell--center profile-screen">
                <div className="floating-blob floating-blob-1" />
                <div className="floating-blob floating-blob-2" />
                <div className="floating-blob floating-blob-3" />
                <div className="app-container profile-page-shell">
                    <PageHeader title={t("profilePageTitle")} backHref="/" backLabel={t("profileBackLabel")} />
                    <LoadingSkeleton variant="card" count={3} />
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell profile-screen">
            <div className="floating-blob floating-blob-1" />
            <div className="floating-blob floating-blob-2" />
            <div className="floating-blob floating-blob-3" />

            <div className="app-container profile-page-shell">
                <PageHeader
                    title={t("profilePageTitle")}
                    backHref="/"
                    backLabel={t("profileBackLabel")}
                    actions={(
                        <>
                            <Link href="/player-card" className="icon-btn mobile-hidden" title={t("profilePlayerCardLabel")} aria-label={t("profilePlayerCardLabel")}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                            </Link>
                            <button onClick={logout} className="icon-btn mobile-hidden profile-header-logout" title={t("profileLogoutLabel")} aria-label={t("profileLogoutLabel")}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                            </button>
                        </>
                    )}
                />

                {error && <div className="profile-alert profile-alert--error">{error}</div>}

                <form className="profile-form-shell" onSubmit={handleUpdateSettings}>
                    <section className="glass-panel profile-hero-card">
                        <div className="profile-hero-main">
                            <div className="profile-avatar">{userInputs.name.charAt(0).toUpperCase()}</div>

                            <div className="profile-hero-copy">
                                <p className="profile-hero-kicker">{t("profileHeroKicker")}</p>
                                <h2 className="profile-hero-name">{userInputs.name}</h2>
                                <p className="profile-hero-email">{authUser?.email}</p>
                                <p className="profile-section-hint">{t("profileHeroHint")}</p>
                            </div>

                            <div className="profile-hero-side">
                                <span className={`profile-tier-pill ${authUser?.tier === "pro" ? "is-pro" : ""}`}>
                                    {authUser?.tier === "pro" ? "PRO" : "FREE"}
                                </span>
                                <Link href="/player-card" className="profile-hero-link">{t("profilePlayerCardLabel")}</Link>
                            </div>
                        </div>
                    </section>

                    <div className="profile-grid">
                        <section className="glass-panel profile-section-card">
                            <div className="profile-section-copy">
                                <p className="profile-section-eyebrow">{t("profileIdentityTitle")}</p>
                                <p className="profile-section-hint">{t("profileIdentityHint")}</p>
                            </div>

                            <div className="profile-fields-grid">
                                <label className="profile-field profile-field--full">
                                    <span className="profile-field-label">{t("profileNameLabel")}</span>
                                    <input type="text" value={userInputs.name} onChange={(e) => setUserInputs({ ...userInputs, name: e.target.value })} />
                                </label>

                                <label className="profile-field">
                                    <span className="profile-field-label">{t("profileSexLabel")}</span>
                                    <select value={userInputs.sex} onChange={(e) => setUserInputs({ ...userInputs, sex: e.target.value })}>
                                        <option value="male">{t("profileSexMale")}</option>
                                        <option value="female">{t("profileSexFemale")}</option>
                                        <option value="other">{t("profileSexOther")}</option>
                                    </select>
                                </label>

                                <label className="profile-field">
                                    <span className="profile-field-label">{t("profileAgeLabel")}</span>
                                    <input type="number" value={userInputs.age} onChange={(e) => setUserInputs({ ...userInputs, age: parseInt(e.target.value, 10) || 0 })} />
                                </label>

                                <label className="profile-field profile-field--unit">
                                    <span className="profile-field-label">{t("profileWeightLabel")}</span>
                                    <input type="number" step="0.1" value={userInputs.weight} onChange={(e) => setUserInputs({ ...userInputs, weight: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitKg")}</span>
                                </label>

                                <label className="profile-field profile-field--unit">
                                    <span className="profile-field-label">{t("profileHeightLabel")}</span>
                                    <input type="number" step="0.1" value={userInputs.height} onChange={(e) => setUserInputs({ ...userInputs, height: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitCm")}</span>
                                </label>
                            </div>

                            <div className="profile-context-card">
                                <div className="profile-section-copy">
                                    <p className="profile-section-eyebrow">{t("profileAiMemoryTitle")}</p>
                                    <p className="profile-section-hint">{t("profileAiMemoryHint")}</p>
                                </div>
                                <textarea
                                    value={userInputs.longTermContext}
                                    onChange={(e) => setUserInputs({ ...userInputs, longTermContext: e.target.value })}
                                    placeholder={t("profileAiMemoryPlaceholder")}
                                />
                            </div>
                        </section>

                        <section className="glass-panel profile-section-card">
                            <div className="profile-section-copy">
                                <p className="profile-section-eyebrow">{t("profileGoalsTitle")}</p>
                                <p className="profile-section-hint">{t("profileGoalsHint")}</p>
                            </div>

                            <div className="profile-section-block">
                                <p className="profile-subheading">{t("profileObjectiveTitle")}</p>
                                <ProfileObjectiveGrid
                                    options={objectiveOptions}
                                    value={goalInputs.objective}
                                    onChange={(value) => setGoalInputs({ ...goalInputs, objective: value })}
                                />
                            </div>

                            <div className="profile-goals-grid">
                                <label className="profile-field profile-field--full profile-field--unit">
                                    <span className="profile-field-label">{t("profileCaloriesLabel")}</span>
                                    <input type="number" min="500" value={goalInputs.calories} onChange={(e) => setGoalInputs({ ...goalInputs, calories: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitKcal")}</span>
                                </label>

                                <label className="profile-field profile-field--unit">
                                    <span className="profile-field-label">{t("profileProteinLabel")}</span>
                                    <input type="number" min="10" value={goalInputs.protein} onChange={(e) => setGoalInputs({ ...goalInputs, protein: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitG")}</span>
                                </label>

                                <label className="profile-field profile-field--unit">
                                    <span className="profile-field-label">{t("profileCarbsLabel")}</span>
                                    <input type="number" min="10" value={goalInputs.carbs} onChange={(e) => setGoalInputs({ ...goalInputs, carbs: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitG")}</span>
                                </label>

                                <label className="profile-field profile-field--unit">
                                    <span className="profile-field-label">{t("profileFatLabel")}</span>
                                    <input type="number" min="5" value={goalInputs.fat} onChange={(e) => setGoalInputs({ ...goalInputs, fat: parseFloat(e.target.value) || 0 })} />
                                    <span className="profile-field-unit">{t("profileUnitG")}</span>
                                </label>
                            </div>
                        </section>
                    </div>

                    <div className="profile-grid profile-grid--secondary">
                        <ProfileUsageCard title={t("profileUsageTitle")} hint={t("profileUsageHint")} items={usageItems} />
                        <ProfileMembershipCard
                            title={t("profileMembershipTitle")}
                            hint={t("profileMembershipHint")}
                            statusLabel={t("profileMembershipStatus")}
                            tierLabel={authUser?.tier === "pro" ? t("profileProMember") : t("profileFreePlan")}
                            actionLabel={authUser?.tier === "pro" ? t("profileDowngrade") : t("profileUpgrade")}
                            isPro={authUser?.tier === "pro"}
                            saving={saving}
                            onAction={handleTierAction}
                        />
                    </div>

                    <div className="profile-note">{t("profileMedicalNote")}</div>

                    <button type="submit" className="primary-btn profile-save-btn" disabled={saving}>
                        {saving ? <span className="loading-dots">{t("profileSaving")}</span> : t("profileSaveButton")}
                    </button>
                </form>

                {showCelebration && (
                    <div className="profile-confetti-layer">
                        {[...Array(30)].map((_, i) => (
                            <div
                                key={i}
                                className="confetti-piece"
                                style={{
                                    left: `${Math.random() * 100}vw`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    background: ["#FFD700", "#FFA500", "#FFFFFF", "#FF6B00"][Math.floor(Math.random() * 4)],
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
