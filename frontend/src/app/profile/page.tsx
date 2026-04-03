"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import PageHeader from "@/components/PageHeader";
import LoadingSkeleton from "@/components/LoadingSkeleton";

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
        "Authorization": `Bearer ${localStorage.getItem('auth_token')}`
    }
}).then(res => {
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

    const triggerCelebration = () => {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
    };

    const [goalInputs, setGoalInputs] = useState<Goals>({ calories: 2000, protein: 150, carbs: 250, fat: 70, objective: "" });
    const [userInputs, setUserInputs] = useState<UserProfile>({ 
        name: "User", 
        age: 25, 
        weight: 70, 
        height: 170, 
        sex: "other",
        onboarded: true,
        tourCompleted: false,
        longTermContext: ""
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
                objective: goalsData.objective || ""
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
                longTermContext: userData.longTermContext || ""
            });
            setLoading(false);
        }
    }, [userData, authUser]);

    useEffect(() => {
        if (goalsError || userError) {
            setError("Failed to load profile data.");
            setLoading(false);
        }
    }, [goalsError, userError]);

    useEffect(() => {
        if (authLoading) return;
        if (!authUser) {
            router.push("/login");
            return;
        }
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
            mutate(`${API_BASE}/goals`);
            mutate(`${API_BASE}/user`);
            // Also invalidate any dashboard summary caches since goals changed
            mutate((key: unknown) => typeof key === 'string' && key.includes('/dashboard/summary'), undefined, { revalidate: true });
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
            <div className="page-shell page-shell--center">
                <div className="floating-blob floating-blob-1" />
                <div className="floating-blob floating-blob-2" />
                <div className="floating-blob floating-blob-3" />
                <div className="app-container" style={{ maxWidth: '600px' }}>
                    <PageHeader
                        title={t('profileSettings')}
                        backHref="/"
                        backLabel={t('back')}
                    />
                    <LoadingSkeleton variant="card" count={3} />
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <div className="floating-blob floating-blob-1" />
            <div className="floating-blob floating-blob-2" />
            <div className="floating-blob floating-blob-3" />
            <div className="app-container" style={{ maxWidth: '600px', alignItems: 'center' }}>
            <PageHeader
                title={t('profileSettings')}
                backHref="/"
                backLabel={t('back')}
                actions={
                    <>
                        <Link href="/player-card" className="icon-btn mobile-hidden" title="Player Card" aria-label="Player Card">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </Link>
                        <button onClick={handleLogout} className="icon-btn mobile-hidden" title={t('logout')} style={{ color: "var(--danger)" }} aria-label={t('logout')}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </>
                }
            />

            {error && (
                <div style={{ background: "rgba(255, 45, 85, 0.1)", borderLeft: "4px solid var(--danger)", padding: "14px 20px", borderRadius: "12px", fontSize: "14px", color: "var(--text-primary)", width: '100%', marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            <div className="glass-panel" style={{ width: '100%', padding: '32px', borderRadius: '32px', marginBottom: '80px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '32px' }}>
                    <div className="profile-avatar">
                        {userInputs.name.charAt(0).toUpperCase()}
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {userInputs.name}
                        {authUser?.tier === 'pro' && (
                            <span style={{ 
                                background: 'linear-gradient(135deg, #FFD700, #FFA500)', 
                                color: 'black', 
                                fontSize: '10px', 
                                fontWeight: 900, 
                                padding: '2px 8px', 
                                borderRadius: '6px',
                                textTransform: 'uppercase',
                                letterSpacing: '1.2px',
                                textShadow: '0 1px 0 rgba(255,255,255,0.2)'
                            }}>
                                PRO
                            </span>
                        )}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '4px' }}>{authUser?.email}</p>
                </div>

                <form onSubmit={handleUpdateSettings}>
                    <div style={{ marginBottom: '32px' }}>
                        <div className="section-header">
                            <div className="section-header-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-pro)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            </div>
                            <h4>{t('userProfile')}</h4>
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

                        {/* Personal AI Context Section */}
                        <div style={{ marginTop: '32px', padding: '24px', background: 'rgba(14, 165, 233, 0.05)', borderRadius: '20px', border: '1px solid rgba(14, 165, 233, 0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div className="icon-btn" style={{ background: 'var(--accent-pro)', border: 'none', width: '28px', height: '28px', cursor: 'default' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 12L2.7 16.5"></path></svg>
                                </div>
                                <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-pro)', fontWeight: 800 }}>{t('aiContextTitle')}</h4>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                                {t('aiContextDesc')}
                            </p>
                            <textarea
                                value={userInputs.longTermContext}
                                onChange={e => setUserInputs({ ...userInputs, longTermContext: e.target.value })}
                                placeholder={t('aiContextPlaceholder')}
                                style={{
                                    width: '100%',
                                    minHeight: '100px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '12px 16px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    resize: 'vertical',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div className="section-header">
                            <div className="section-header-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-fat)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h4>{t('healthObjective')}</h4>
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
                                    className={`glass-btn objective-btn ${goalInputs.objective === opt.value ? 'active' : ''}`}
                                    style={{
                                        border: goalInputs.objective === opt.value ? '2px solid var(--accent-pro)' : '1px solid var(--panel-border)',
                                        background: goalInputs.objective === opt.value ? 'rgba(14, 165, 233, 0.1)' : 'rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <span style={{ fontSize: '24px' }}>{opt.emoji}</span>
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div className="section-header">
                            <div className="section-header-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-cal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <h4>{t('dailyGoals')}</h4>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
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
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('carbs')}</label>
                                <input
                                    type="number"
                                    required
                                    min="10"
                                    value={goalInputs.carbs}
                                    onChange={e => setGoalInputs({ ...goalInputs, carbs: parseFloat(e.target.value) || 0 })}
                                    style={{ height: '52px', borderRadius: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--panel-border)', padding: '0 20px', width: '100%' }}
                                />
                                <span style={{ position: 'absolute', right: '16px', top: '42px', fontSize: '11px', fontWeight: 800, color: 'var(--accent-carb)' }}>G</span>
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

                    {/* Daily AI Usage Section (Only for Free users or helpful for Pro to see activity) */}
                    <div style={{ marginBottom: '32px' }}>
                        <div className="section-header">
                            <div className="section-header-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-carb)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7"></path><path d="M16 19h6"></path><path d="M19 16v6"></path></svg>
                            </div>
                            <h4>Daily AI Credits</h4>
                        </div>
                        
                        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.2)' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>Food Scans</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {authUser?.usage?.aiScanCount || 0} / {authUser?.tier === 'pro' ? '∞' : '3'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: authUser?.tier === 'pro' ? '100%' : `${Math.min(100, ((authUser?.usage?.aiScanCount || 0) / 3) * 100)}%`,
                                        background: 'var(--accent-cal)',
                                        borderRadius: '10px',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>AI Consulting</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {authUser?.usage?.aiChatCount || 0} / {authUser?.tier === 'pro' ? '∞' : '5'}
                                    </span>
                                </div>
                                <div style={{ height: '6px', width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        height: '100%', 
                                        width: authUser?.tier === 'pro' ? '100%' : `${Math.min(100, ((authUser?.usage?.aiChatCount || 0) / 5) * 100)}%`,
                                        background: 'var(--accent-pro)',
                                        borderRadius: '10px',
                                        transition: 'width 0.5s ease-out'
                                    }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Subscription & Tier Section */}
                    <div style={{ marginBottom: '32px' }}>
                        <div className="section-header">
                            <div className="section-header-icon" style={{ background: 'rgba(255,215,0,0.1)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="gold" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                            </div>
                            <h4>Subscription & Tier</h4>
                        </div>
                        
                        <div className="glass-panel" style={{ padding: '24px', background: 'rgba(255,215,0,0.05)', borderRadius: '24px', border: '1px solid rgba(255,215,0,0.15)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 900, color: 'gold', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '4px' }}>Membership Status</p>
                                    <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 900, textTransform: 'uppercase' }}>
                                        {authUser?.tier === 'pro' ? '🌟 Pro Member' : 'Free Plan'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setSaving(true);
                                        try {
                                            const endpoint = authUser?.tier === 'pro' ? 'mock-downgrade' : 'mock-upgrade';
                                            const token = localStorage.getItem("auth_token");
                                            const res = await fetch(`${API_BASE}/user/${endpoint}`, {
                                                method: "POST",
                                                headers: { "Authorization": `Bearer ${token}` }
                                            });
                                            if (res.ok) {
                                                if (endpoint === 'mock-upgrade') {
                                                    triggerCelebration();
                                                    showToast("🌟 WELCOME TO PRO! Enjoy unlimited access.", "success");
                                                } else {
                                                    showToast("Account reverted to Free tier.", "success");
                                                }
                                                await refreshUser?.();
                                            }
                                        } catch (e) {
                                            showToast("Error", "error");
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                    disabled={saving}
                                    style={{ 
                                        padding: '10px 18px', 
                                        borderRadius: '14px',
                                        fontSize: '11px', 
                                        fontWeight: 900,
                                        background: authUser?.tier === 'pro' ? 'rgba(255,255,255,0.05)' : 'gold',
                                        color: authUser?.tier === 'pro' ? '#ccc' : '#000',
                                        border: authUser?.tier === 'pro' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                    }}
                                >
                                    {authUser?.tier === 'pro' ? 'DOWNGRADE' : 'UPGRADE TO PRO'}
                                </button>
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
            {showCelebration && (
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 10001, overflow: 'hidden' }}>
                    {[...Array(30)].map((_, i) => (
                        <div 
                            key={i} 
                            className="confetti-piece" 
                            style={{ 
                                left: `${Math.random() * 100}vw`, 
                                animationDelay: `${Math.random() * 2}s`,
                                background: ['#FFD700', '#FFA500', '#FFFFFF', '#FF6B00'][Math.floor(Math.random() * 4)]
                            }} 
                        />
                    ))}
                </div>
            )}
            </div>
        </div>
    );
}
