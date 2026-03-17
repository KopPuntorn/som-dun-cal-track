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
        <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", position: "relative" }}>
            {/* Decorative background glows */}
            <div style={{ position: "absolute", top: "15%", right: "15%", width: "35vw", height: "35vw", background: "var(--accent-pro)", opacity: 0.1, filter: "blur(120px)", borderRadius: "50%" }}></div>
            <div style={{ position: "absolute", bottom: "15%", left: "15%", width: "35vw", height: "35vw", background: "var(--accent-fat)", opacity: 0.1, filter: "blur(120px)", borderRadius: "50%" }}></div>

            <div className="glass-panel" style={{ width: "100%", maxWidth: "540px", padding: "48px", borderRadius: '32px', zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: "40px" }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: "12px", background: 'var(--accent-cal-gradient)', WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        Welcome, {user.name}!
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: '15px', fontWeight: 500 }}>Let's build your high-performance profile.</p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "32px" }}>
                        <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: step === 1 ? "var(--accent-cal-gradient)" : "rgba(255,255,255,0.08)", transition: 'all 0.4s' }}></div>
                        <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: step === 2 ? "var(--accent-cal-gradient)" : "rgba(255,255,255,0.08)", transition: 'all 0.4s' }}></div>
                    </div>
                </div>

                {step === 1 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', cursor: 'default' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pro)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Biometrics</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Age</label>
                                <input type="number" value={profile.age || ''} onChange={e => setProfile({ ...profile, age: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px' }} />
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Sex</label>
                                <select value={profile.sex} onChange={e => setProfile({ ...profile, sex: e.target.value })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', color: '#fff', width: '100%', fontWeight: 600 }}>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Weight</label>
                                <input type="number" value={profile.weight || ''} onChange={e => setProfile({ ...profile, weight: e.target.value === '' ? 0 : parseFloat(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>KG</span>
                            </div>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Height</label>
                                <input type="number" value={profile.height || ''} onChange={e => setProfile({ ...profile, height: e.target.value === '' ? 0 : parseFloat(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>CM</span>
                            </div>
                        </div>

                        <button className="primary-btn active" onClick={() => setStep(2)} style={{ marginTop: "16px", height: '56px', borderRadius: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                            NEXT PHASE
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', cursor: 'default' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Daily Targets</h2>
                        </div>

                        <div className="input-group" style={{ position: 'relative' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Calorie Goal</label>
                            <input type="number" value={goals.calories || ''} onChange={e => setGoals({ ...goals, calories: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                            <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-cal)' }}>KCAL</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Protein</label>
                                <input type="number" value={goals.protein || ''} onChange={e => setGoals({ ...goals, protein: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-pro)' }}>G</span>
                            </div>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Fat</label>
                                <input type="number" value={goals.fat || ''} onChange={e => setGoals({ ...goals, fat: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-fat)' }}>G</span>
                            </div>
                        </div>

                        <div style={{ marginTop: "8px" }}>
                            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px", display: "block", textTransform: 'uppercase', letterSpacing: '1px' }}>
                                🎯 {t('healthObjective')}
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
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
                                        className="glass-btn"
                                        style={{
                                            padding: '16px 8px',
                                            flexDirection: 'column',
                                            gap: '8px',
                                            height: 'auto',
                                            border: goals.objective === opt.value ? '2px solid var(--accent-pro)' : '1px solid var(--panel-border)',
                                            background: goals.objective === opt.value ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <span style={{ fontSize: '24px' }}>{opt.emoji}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                            <button className="glass-btn" onClick={() => setStep(1)} style={{ flex: 1, height: '56px', borderRadius: '16px' }}>BACK</button>
                            <button className="primary-btn active" onClick={handleComplete} disabled={loading} style={{ flex: 2, height: '56px', borderRadius: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                                {loading ? (
                                    <div className="loading-dots">SAVING...</div>
                                ) : "START TRACKING!"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
