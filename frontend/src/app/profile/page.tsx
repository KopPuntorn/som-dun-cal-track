"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

type Goals = {
    calories: number;
    protein: number;
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
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined") 
    ? process.env.NEXT_PUBLIC_API_URL 
    : "http://localhost:8080/api";

export default function ProfilePage() {
    const { user: authUser, logout, isLoading: authLoading } = useAuth();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [goalInputs, setGoalInputs] = useState<Goals>({ calories: 2000, protein: 150, fat: 70, objective: "" });
    const [userInputs, setUserInputs] = useState<UserProfile>({ 
        name: "User", 
        age: 25, 
        weight: 70, 
        height: 170, 
        sex: "other",
        onboarded: true,
        tourCompleted: false 
    });

    useEffect(() => {
        if (authLoading) return;
        if (!authUser) {
            router.push("/login");
            return;
        }

        async function fetchData() {
            try {
                const [goalsRes, userRes] = await Promise.all([
                    fetch(`${API_BASE}/goals`),
                    fetch(`${API_BASE}/user`)
                ]);

                if (goalsRes.ok) {
                    const g = await goalsRes.json();
                    setGoalInputs({
                        calories: g.calories || 2000,
                        protein: g.protein || 150,
                        fat: g.fat || 70,
                        objective: g.objective || ""
                    });
                }

                if (userRes.ok) {
                    const u = await userRes.json();
                    setUserInputs({
                        name: u.name || authUser?.name || "User",
                        age: u.age || 25,
                        weight: u.weight || 70,
                        height: u.height || 170,
                        sex: u.sex || "other",
                        onboarded: u.onboarded ?? true,
                        tourCompleted: u.tourCompleted ?? false
                    });
                }
            } catch (err) {
                console.error("Failed to fetch profile data", err);
                setError("Failed to load profile data.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [authLoading, authUser, router]);

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const [goalsRes, userRes] = await Promise.all([
                fetch(`${API_BASE}/goals`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(goalInputs),
                }),
                fetch(`${API_BASE}/user`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(userInputs),
                })
            ]);

            if (!goalsRes.ok || !userRes.ok) throw new Error("Failed to save settings");

            showToast("Profile & Goals Updated!", "success");
        } catch (err) {
            console.error(err);
            setError("Failed to update settings");
            showToast("Failed to save profile", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
    };

    if (authLoading || loading) {
        return (
            <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div className="loading-dots" style={{ fontSize: '24px' }}>Loading Profile...</div>
            </div>
        );
    }

    return (
        <div className="app-container" style={{ maxWidth: '600px', alignItems: 'center' }}>
            {/* Header */}
            <header className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "16px 24px", borderRadius: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => router.push("/")} className="icon-btn" title={t('back')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                </div>
                <h1 style={{ fontSize: "20px", margin: 0, background: 'none', WebkitTextFillColor: 'var(--text-primary)' }}>{t('profileSettings')}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Link href="/player-card" className="icon-btn" title="Player Card">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </Link>
                    <button onClick={handleLogout} className="icon-btn" title={t('logout')} style={{ color: "var(--danger)" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            {error && (
                <div style={{ background: "rgba(255, 45, 85, 0.1)", borderLeft: "4px solid var(--danger)", padding: "14px 20px", borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)", width: '100%', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            <div className="glass-panel" style={{ width: '100%', padding: '40px', borderRadius: '32px', marginBottom: '80px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '35px', background: 'var(--accent-cal-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 800, color: '#fff', boxShadow: '0 15px 35px rgba(255, 107, 0, 0.25)', marginBottom: '20px' }}>
                        {userInputs.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{userInputs.name}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '4px' }}>{authUser?.email}</p>
                </div>

                <form onSubmit={handleUpdateSettings}>
                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '32px', height: '32px', cursor: 'default' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pro)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('userProfile')}</h4>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('name')}</label>
                                <input
                                    type="text"
                                    value={userInputs.name}
                                    onChange={e => setUserInputs({ ...userInputs, name: e.target.value })}
                                    style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('sex')}</label>
                                    <select
                                        value={userInputs.sex}
                                        onChange={e => setUserInputs({ ...userInputs, sex: e.target.value })}
                                        style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 16px', color: '#fff', width: '100%', fontWeight: 600 }}
                                    >
                                        <option value="male">{t('male')}</option>
                                        <option value="female">{t('female')}</option>
                                        <option value="other">{t('other')}</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('age')}</label>
                                    <input
                                        type="number"
                                        value={userInputs.age}
                                        onChange={e => setUserInputs({ ...userInputs, age: parseInt(e.target.value) || 0 })}
                                        style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="input-group" style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('weight')}</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={userInputs.weight}
                                        onChange={e => setUserInputs({ ...userInputs, weight: parseFloat(e.target.value) || 0 })}
                                        style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                    />
                                    <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>KG</span>
                                </div>
                                <div className="input-group" style={{ position: 'relative' }}>
                                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('height')}</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={userInputs.height}
                                        onChange={e => setUserInputs({ ...userInputs, height: parseFloat(e.target.value) || 0 })}
                                        style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                    />
                                    <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)' }}>CM</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '32px', height: '32px', cursor: 'default' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fat)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('healthObjective')}</h4>
                        </div>
                        
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
                                    onClick={() => setGoalInputs({ ...goalInputs, objective: opt.value })}
                                    className="glass-btn"
                                    style={{
                                        padding: '16px 8px',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        height: 'auto',
                                        border: goalInputs.objective === opt.value ? '2px solid var(--accent-pro)' : '1px solid var(--panel-border)',
                                        background: goalInputs.objective === opt.value ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <span style={{ fontSize: '24px' }}>{opt.emoji}</span>
                                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div className="icon-btn" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '32px', height: '32px', cursor: 'default' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('dailyGoals')}</h4>
                        </div>

                        <div className="input-group" style={{ position: 'relative', marginBottom: '20px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('calories')}</label>
                            <input
                                type="number"
                                required
                                min="500"
                                value={goalInputs.calories}
                                onChange={e => setGoalInputs({ ...goalInputs, calories: parseFloat(e.target.value) || 0 })}
                                style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                            />
                            <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-cal)' }}>KCAL</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('protein')}</label>
                                <input
                                    type="number"
                                    required
                                    min="10"
                                    value={goalInputs.protein}
                                    onChange={e => setGoalInputs({ ...goalInputs, protein: parseFloat(e.target.value) || 0 })}
                                    style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-pro)' }}>G</span>
                            </div>
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('fat')}</label>
                                <input
                                    type="number"
                                    required
                                    min="5"
                                    value={goalInputs.fat}
                                    onChange={e => setGoalInputs({ ...goalInputs, fat: parseFloat(e.target.value) || 0 })}
                                    style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-fat)' }}>G</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', borderLeft: '4px solid var(--accent-pro)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                            * {t('medicalDisclaimer')}
                        </p>
                    </div>

                    <button type="submit" className="primary-btn active" disabled={saving} style={{ height: '60px', width: '100%', fontSize: '16px', fontWeight: 700, letterSpacing: '1px', borderRadius: '18px' }}>
                        {saving ? (
                            <div className="loading-dots">SAVING CHANGES...</div>
                        ) : t('saveProfile').toUpperCase()}
                    </button>
                </form>
            </div>
        </div>
    );
}
