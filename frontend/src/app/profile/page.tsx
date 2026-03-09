"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

type Goals = {
    calories: number;
    protein: number;
    fat: number;
};

type UserProfile = {
    name: string;
    age: number;
    weight: number;
    height: number;
    sex: string;
};

const API_BASE = "http://localhost:8080/api";

export default function ProfilePage() {
    const { user: authUser, logout, isLoading: authLoading } = useAuth();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [goalInputs, setGoalInputs] = useState<Goals>({ calories: 2000, protein: 150, fat: 70 });
    const [userInputs, setUserInputs] = useState<UserProfile>({ name: "User", age: 25, weight: 70, height: 170, sex: "other" });

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
                        fat: g.fat || 70
                    });
                }

                if (userRes.ok) {
                    const u = await userRes.json();
                    setUserInputs({
                        name: u.name || authUser?.name || "User",
                        age: u.age || 25,
                        weight: u.weight || 70,
                        height: u.height || 170,
                        sex: u.sex || "other"
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
        <div className="app-container" style={{ maxWidth: '800px' }}>
            <header className="main-header" style={{ background: 'transparent', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button onClick={() => router.push("/")} className="icon-btn" title={t('back')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <h1>{t('profileSettings')}</h1>
                </div>
                <button onClick={handleLogout} className="icon-btn" title={t('logout')} style={{ color: "var(--danger)" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                </button>
            </header>

            {error && (
                <div style={{ background: "var(--danger)", padding: "12px", borderRadius: "12px", fontSize: "14px", color: "white", marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            <div className="glass-panel" style={{ marginBottom: '100px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'var(--accent-pro-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                        {userInputs.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2 style={{ margin: 0 }}>{userInputs.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>{authUser?.email}</p>
                    </div>
                </div>

                <form className="settings-form" onSubmit={handleUpdateSettings}>
                    <div style={{ marginBottom: '40px' }}>
                        <h4 style={{ color: 'var(--accent-cal)', marginBottom: '20px', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>{t('userProfile')}</h4>
                        <div className="responsive-layout" style={{ gap: '20px' }}>
                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('name')}</label>
                                <input
                                    type="text"
                                    value={userInputs.name}
                                    onChange={e => setUserInputs({ ...userInputs, name: e.target.value })}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('sex')}</label>
                                <select
                                    value={userInputs.sex}
                                    onChange={e => setUserInputs({ ...userInputs, sex: e.target.value })}
                                    style={{ background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '14px 18px', fontSize: '15px', appearance: 'none', width: '100%' }}
                                >
                                    <option value="male">{t('male')}</option>
                                    <option value="female">{t('female')}</option>
                                    <option value="other">{t('other')}</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label>{t('age')}</label>
                                <input
                                    type="number"
                                    value={userInputs.age}
                                    onChange={e => setUserInputs({ ...userInputs, age: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('weight')} (kg)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={userInputs.weight}
                                    onChange={e => setUserInputs({ ...userInputs, weight: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('height')} (cm)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={userInputs.height}
                                    onChange={e => setUserInputs({ ...userInputs, height: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ color: 'var(--accent-pro)', marginBottom: '20px', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>{t('dailyGoals')}</h4>
                        <div className="responsive-layout" style={{ gap: '20px' }}>
                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                <label>{t('calories')} (kcal)</label>
                                <input
                                    type="number"
                                    required
                                    min="500"
                                    value={goalInputs.calories}
                                    onChange={e => setGoalInputs({ ...goalInputs, calories: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('protein')} (g)</label>
                                <input
                                    type="number"
                                    required
                                    min="10"
                                    value={goalInputs.protein}
                                    onChange={e => setGoalInputs({ ...goalInputs, protein: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="input-group">
                                <label>{t('fat')} (g)</label>
                                <input
                                    type="number"
                                    required
                                    min="5"
                                    value={goalInputs.fat}
                                    onChange={e => setGoalInputs({ ...goalInputs, fat: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="primary-btn" disabled={saving} style={{ marginTop: '32px', padding: '18px', width: '100%', fontSize: '16px' }}>
                        {saving ? t('saving') : t('saveProfile')}
                    </button>
                </form>
            </div>
        </div>
    );
}
