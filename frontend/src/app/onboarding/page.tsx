"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export default function OnboardingPage() {
    const { user, login, isLoading } = useAuth();
    const router = useRouter();
    const { t } = useLanguage();
    const { showToast } = useToast();

    const [step, setStep] = useState(1);
    const [profile, setProfile] = useState({
        name: user?.name || "",
        age: 25,
        weight: 70,
        height: 170,
        sex: "other"
    });

    const [goals, setGoals] = useState({
        calories: 2000,
        protein: 150,
        fat: 70,
        objective: ""
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.push("/login");
        } else if (!isLoading && user?.onboarded) {
            router.push("/");
        }
    }, [user, isLoading, router]);

    const handleComplete = async () => {
        setLoading(true);
        try {
            // 1. Update Profile & Mark as Onboarded
            const profileRes = await fetch(`${API_BASE}/user`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...profile, onboarded: true })
            });

            // 2. Update Goals
            const goalsRes = await fetch(`${API_BASE}/goals`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(goals)
            });

            if (profileRes.ok && goalsRes.ok) {
                const updatedUser = await profileRes.json();
                // Update local context
                const token = localStorage.getItem("auth_token");
                if (token) {
                    login(token, updatedUser);
                }
                showToast("Welcome! Your profile is set up.", "success");
                router.push("/");
            } else {
                showToast("Failed to save settings", "error");
            }
        } catch (err) {
            showToast("Network error", "error");
        } finally {
            setLoading(false);
        }
    };

    if (isLoading || !user) return <div className="app-container">Loading...</div>;

    return (
        <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
            <div className="glass-panel" style={{ width: "100%", maxWidth: "500px", padding: "40px" }}>
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <h1 style={{ marginBottom: "8px" }}>Welcome, {user.name}!</h1>
                    <p style={{ color: "var(--text-secondary)" }}>Let's set up your personalized plan.</p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginTop: "20px" }}>
                        <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: step === 1 ? "var(--accent-cal)" : "rgba(255,255,255,0.1)" }}></div>
                        <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: step === 2 ? "var(--accent-cal)" : "rgba(255,255,255,0.1)" }}></div>
                    </div>
                </div>

                {step === 1 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <h2 style={{ fontSize: "18px" }}>Profile Information</h2>
                        <div className="input-group">
                            <label>Age</label>
                            <input type="number" value={profile.age} onChange={e => setProfile({ ...profile, age: parseInt(e.target.value) })} />
                        </div>
                        <div className="input-group">
                            <label>Weight (kg)</label>
                            <input type="number" value={profile.weight} onChange={e => setProfile({ ...profile, weight: parseFloat(e.target.value) })} />
                        </div>
                        <div className="input-group">
                            <label>Height (cm)</label>
                            <input type="number" value={profile.height} onChange={e => setProfile({ ...profile, height: parseFloat(e.target.value) })} />
                        </div>
                        <div className="input-group">
                            <label>Sex</label>
                            <select value={profile.sex} onChange={e => setProfile({ ...profile, sex: e.target.value })} style={{ background: "var(--panel-bg)", color: "#fff", padding: "12px", borderRadius: "12px", border: "1px solid var(--panel-border)" }}>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <button className="primary-btn" onClick={() => setStep(2)} style={{ marginTop: "20px" }}>Next Step</button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <h2 style={{ fontSize: "18px" }}>Daily Goals</h2>
                        <div className="input-group">
                            <label>Calorie Goal (kcal)</label>
                            <input type="number" value={goals.calories} onChange={e => setGoals({ ...goals, calories: parseInt(e.target.value) })} />
                        </div>
                        <div className="input-group">
                            <label>Protein Goal (g)</label>
                            <input type="number" value={goals.protein} onChange={e => setGoals({ ...goals, protein: parseInt(e.target.value) })} />
                        </div>
                        <div className="input-group">
                            <label>Fat Goal (g)</label>
                            <input type="number" value={goals.fat} onChange={e => setGoals({ ...goals, fat: parseInt(e.target.value) })} />
                        </div>

                        <div style={{ marginTop: "8px" }}>
                            <label style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px", display: "block" }}>🎯 {t('healthObjective')}</label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                                {[
                                    { value: '', label: t('noObjective'), emoji: '➖' },
                                    { value: 'lose_fat', label: t('loseFat'), emoji: '🔥' },
                                    { value: 'lose_weight', label: t('loseWeight'), emoji: '⬇️' },
                                    { value: 'gain_weight', label: t('gainWeight'), emoji: '⬆️' },
                                    { value: 'build_muscle', label: t('buildMuscle'), emoji: '💪' },
                                    { value: 'maintain', label: t('maintain'), emoji: '⚖️' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setGoals({ ...goals, objective: opt.value })}
                                        style={{
                                            padding: '14px 6px',
                                            borderRadius: '14px',
                                            border: goals.objective === opt.value ? '2px solid var(--accent-pro)' : '1px solid rgba(255,255,255,0.1)',
                                            background: goals.objective === opt.value ? 'rgba(var(--accent-pro-rgb, 100, 200, 255), 0.15)' : 'rgba(0,0,0,0.3)',
                                            color: goals.objective === opt.value ? 'var(--accent-pro)' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: goals.objective === opt.value ? '600' : '400',
                                            display: 'flex',
                                            flexDirection: 'column' as const,
                                            alignItems: 'center',
                                            gap: '4px',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <span style={{ fontSize: '20px' }}>{opt.emoji}</span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                            <button className="primary-btn outline" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</button>
                            <button className="primary-btn" onClick={handleComplete} disabled={loading} style={{ flex: 2 }}>
                                {loading ? "Saving..." : "Start Tracking!"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
