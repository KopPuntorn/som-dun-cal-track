"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [aiExplanation, setAiExplanation] = useState("");

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

    const handleAiSuggest = async () => {
        setIsAiGenerating(true);
        setAiExplanation("");
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`${API_BASE}/suggest-goals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    age: profile.age,
                    weight: profile.weight,
                    height: profile.height,
                    sex: profile.sex,
                    objective: goals.objective,
                    language: language
                })
            });

            if (!res.ok) throw new Error('Failed to suggest goals');
            const json = await res.json();
            
            setGoals({
                ...goals,
                calories: json.calories,
                protein: json.protein,
                fat: json.fat
            });
            setAiExplanation(json.explanation);
            showToast("Goals suggested by AI!", "success");
        } catch (error) {
            console.error(error);
            showToast("AI Goal suggestion failed.", "error");
        } finally {
            setIsAiGenerating(false);
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
                        {t('welcomeName').replace('{name}', user.name)}
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: '15px', fontWeight: 500 }}>{t('buildProfileDesc')}</p>

                    <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "32px" }}>
                        <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: step === 0 ? "var(--accent-cal-gradient)" : "rgba(255,255,255,0.08)", transition: 'all 0.4s' }}></div>
                        <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: step === 1 ? "var(--accent-cal-gradient)" : "rgba(255,255,255,0.08)", transition: 'all 0.4s' }}></div>
                        <div style={{ width: "60px", height: "6px", borderRadius: "3px", background: step === 2 ? "var(--accent-cal-gradient)" : "rgba(255,255,255,0.08)", transition: 'all 0.4s' }}></div>
                    </div>
                </div>

                {step === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', cursor: 'default' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pro)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12H3M3 12l7-7M3 12l7 7"></path></svg>
                            </div>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{t('chooseLanguage')}</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <button 
                                className="glass-btn" 
                                onClick={() => setLanguage('en')}
                                style={{ 
                                    flexDirection: 'column', 
                                    height: '120px', 
                                    gap: '12px',
                                    border: language === 'en' ? '2px solid var(--accent-pro)' : '1px solid var(--panel-border)',
                                    background: language === 'en' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.2)'
                                }}
                            >
                                <span style={{ fontSize: '32px' }}>🇺🇸</span>
                                <span style={{ fontWeight: 700 }}>English</span>
                            </button>
                            <button 
                                className="glass-btn" 
                                onClick={() => setLanguage('th')}
                                style={{ 
                                    flexDirection: 'column', 
                                    height: '120px', 
                                    gap: '12px',
                                    border: language === 'th' ? '2px solid var(--accent-pro)' : '1px solid var(--panel-border)',
                                    background: language === 'th' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.2)'
                                }}
                            >
                                <span style={{ fontSize: '32px' }}>🇹🇭</span>
                                <span style={{ fontWeight: 700 }}>ภาษาไทย</span>
                            </button>
                        </div>

                        <button className="primary-btn active" onClick={() => setStep(1)} style={{ marginTop: "16px", height: '56px', borderRadius: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                            {t('startOnboarding')}
                        </button>
                    </div>
                ) : step === 1 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', cursor: 'default' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pro)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{t('biometrics')}</h2>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('name')}</label>
                                <input 
                                    type="text" 
                                    placeholder="Your Name" 
                                    value={profile.name} 
                                    onChange={e => setProfile({ ...profile, name: e.target.value })} 
                                    style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} 
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('age')}</label>
                                <input type="number" value={profile.age || ''} onChange={e => setProfile({ ...profile, age: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px' }} />
                            </div>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('sex')}</label>
                                <select value={profile.sex} onChange={e => setProfile({ ...profile, sex: e.target.value })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', color: '#fff', width: '100%', fontWeight: 600 }}>
                                    <option value="male">{t('male')}</option>
                                    <option value="female">{t('female')}</option>
                                    <option value="other">{t('other')}</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('weight')}</label>
                                <input type="number" value={profile.weight || ''} onChange={e => setProfile({ ...profile, weight: e.target.value === '' ? 0 : parseFloat(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{t('unitKg')}</span>
                            </div>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('height')}</label>
                                <input type="number" value={profile.height || ''} onChange={e => setProfile({ ...profile, height: e.target.value === '' ? 0 : parseFloat(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>{t('unitCm')}</span>
                            </div>
                            </div>
                        </div>

                        <button className="primary-btn active" onClick={() => setStep(2)} style={{ marginTop: "16px", height: '56px', borderRadius: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                            {t('nextPhase')}
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
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

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '36px', height: '36px', cursor: 'default' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </div>
                                <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{t('dailyTargets')}</h2>
                            </div>
                            <button 
                                className="glass-btn" 
                                onClick={handleAiSuggest} 
                                disabled={isAiGenerating}
                                style={{ 
                                    padding: '8px 16px', 
                                    fontSize: '12px', 
                                    fontWeight: 700, 
                                    color: 'var(--accent-pro)', 
                                    border: '1px solid var(--accent-pro)',
                                    borderRadius: '12px',
                                    height: 'auto',
                                    background: 'rgba(14, 165, 233, 0.1)'
                                }}
                            >
                                {isAiGenerating ? t('aiSuggesting') : `✨ ${t('suggestGoalsAi')}`}
                            </button>
                        </div>

                        {aiExplanation && (
                            <div style={{ 
                                padding: '16px', 
                                borderRadius: '16px', 
                                background: 'rgba(14, 165, 233, 0.05)', 
                                border: '1px solid rgba(14, 165, 233, 0.2)',
                                marginBottom: '8px'
                            }}>
                                <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-pro)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                                    {t('aiExplanation')}
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{aiExplanation}</p>
                            </div>
                        )}

                        <div className="input-group" style={{ position: 'relative' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('calorieGoal')}</label>
                            <input type="number" value={goals.calories || ''} onChange={e => setGoals({ ...goals, calories: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                            <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-cal)' }}>{t('unitKcal')}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('protein')}</label>
                                <input type="number" value={goals.protein || ''} onChange={e => setGoals({ ...goals, protein: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-pro)' }}>{t('unitG')}</span>
                            </div>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('fat')}</label>
                                <input type="number" value={goals.fat || ''} onChange={e => setGoals({ ...goals, fat: e.target.value === '' ? 0 : parseInt(e.target.value) })} style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', width: '100%' }} />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-fat)' }}>{t('unitG')}</span>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                            <button className="glass-btn" onClick={() => setStep(step - 1)} style={{ flex: 1, height: '56px', borderRadius: '16px' }}>{t('back')}</button>
                            <button className="primary-btn active" onClick={handleComplete} disabled={loading} style={{ flex: 2, height: '56px', borderRadius: '16px', fontWeight: 700, letterSpacing: '1px' }}>
                                {loading ? (
                                    <div className="loading-dots">{t('saving')}</div>
                                ) : t('startTracking')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
