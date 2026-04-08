"use client";

import { useState, useEffect, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    ReferenceLine,
    Cell,
    PieChart,
    Pie,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isBefore, eachDayOfInterval } from 'date-fns';
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import PageHeader from "@/components/PageHeader";
import { SkeletonChart } from "@/components/LoadingSkeleton";

type Food = {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    date: string;
    mealCategory?: string;
};

type ExerciseRecord = {
    id?: string;
    date: string;
    name: string;
    durationMinutes: number;
    caloriesBurned: number;
};

type SleepRecord = {
    id?: string;
    date: string;
    durationHours: number;
    quality: string;
};

type Goals = {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
};

type UserProfile = {
    name: string;
    age: number;
    weight: number;
    height: number;
    sex: string;
};

type WeightRecord = {
    id?: string;
    weight: number;
    date: string;
};

type BodyMeasurement = {
    id?: string;
    userId?: string;
    date: string;
    weight: number;
    waistCircumference: number;
    bodyFatPercentage: number;
    progressPhotoUrl?: string;
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

type RangeType = 'today' | 'week' | 'month' | 'custom';

const DASHBOARD_THEME = {
    nutrition: {
        solid: '#f97316',
        gradientStart: '#fdba74',
        gradientEnd: '#f97316',
        glow: 'rgba(249, 115, 22, 0.22)',
    },
    protein: {
        solid: '#38bdf8',
        gradientStart: '#7dd3fc',
        gradientEnd: '#0ea5e9',
        glow: 'rgba(56, 189, 248, 0.22)',
    },
    carbs: {
        solid: '#f59e0b',
        gradientStart: '#fbbf24',
        gradientEnd: '#f97316',
        glow: 'rgba(245, 158, 11, 0.22)',
    },
    fitness: {
        solid: '#22c55e',
        gradientStart: '#4ade80',
        gradientEnd: '#16a34a',
        glow: 'rgba(34, 197, 94, 0.22)',
    },
    recovery: {
        solid: '#a855f7',
        gradientStart: '#c084fc',
        gradientEnd: '#9333ea',
        glow: 'rgba(168, 85, 247, 0.22)',
    },
    macroProtein: {
        solid: '#14b8a6',
        gradientStart: '#5eead4',
        gradientEnd: '#0f766e',
        glow: 'rgba(20, 184, 166, 0.22)',
    },
    macroCarbs: {
        solid: '#fb7185',
        gradientStart: '#fda4af',
        gradientEnd: '#e11d48',
        glow: 'rgba(251, 113, 133, 0.22)',
    },
    macroFat: {
        solid: '#eab308',
        gradientStart: '#fde047',
        gradientEnd: '#ca8a04',
        glow: 'rgba(234, 179, 8, 0.22)',
    },
    danger: {
        solid: '#ef4444',
        gradientStart: '#f87171',
        gradientEnd: '#dc2626',
        glow: 'rgba(239, 68, 68, 0.22)',
    },
};

const getToggleButtonStyle = (active: boolean, color: string, glow: string) => ({
    padding: '6px 12px',
    fontSize: '12px',
    height: 'auto',
    borderRadius: '8px',
    ...(active
        ? {
            background: color,
            color: '#081012',
            borderColor: color,
            boxShadow: `0 0 0 1px ${color}, 0 10px 20px ${glow}`,
        }
        : {
            color: 'var(--text-secondary)',
        }),
});

export default function DashboardPage() {
    const { logout, isLoading: authLoading } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const [foods, setFoods] = useState<Food[]>([]);
    const [goals, setGoals] = useState<Goals>({ calories: 2000, protein: 150, carbs: 250, fat: 70 });
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<RangeType>('week');
    const [error, setError] = useState<string | null>(null);

    const [weights, setWeights] = useState<WeightRecord[]>([]);

    const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);

    const [exercises, setExercises] = useState<ExerciseRecord[]>([]);

    const [sleeps, setSleeps] = useState<SleepRecord[]>([]);

    const [customStart, setCustomStart] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [aiLoading, setAiLoading] = useState(false);
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [macroView, setMacroView] = useState<'protein' | 'carbs' | 'fat'>('protein');
    const [measureView, setMeasureView] = useState<'weight' | 'waist' | 'bodyFat'>('weight');
    const [healthView, setHealthView] = useState<'exercise' | 'sleep'>('exercise');

    const dashboardKey = useMemo(() => {
        if (authLoading) return null;
        const now = new Date();
        let start: Date | null = null;
        let end: Date = endOfDay(now);

        switch (range) {
            case 'today': start = startOfDay(now); break;
            case 'week': start = startOfDay(subDays(now, 6)); break;
            case 'month': start = startOfDay(subDays(now, 29)); break;
            case 'custom':
                if (customStart && customEnd) {
                    start = startOfDay(new Date(customStart));
                    end = endOfDay(new Date(customEnd));
                } else {
                    start = startOfDay(now);
                }
                break;
        }
        let url = `${API_BASE}/dashboard/summary`;
        if (start) {
            url += `?start=${start.toISOString()}&end=${end.toISOString()}`;
        }
        return url;
    }, [range, customStart, customEnd, authLoading]);

    const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR(dashboardKey, fetcher, { revalidateOnFocus: true });

    const handleGetAiAdvice = async () => {
        setAiLoading(true);
        setAiAdvice(null);
        setError(null);

        const now = new Date();
        let startStr: string;
        let endStr: string = format(now, 'yyyy-MM-dd');

        switch (range) {
            case 'today':
                startStr = endStr;
                break;
            case 'week':
                startStr = format(subDays(now, 6), 'yyyy-MM-dd');
                break;
            case 'month':
                startStr = format(subDays(now, 29), 'yyyy-MM-dd');
                break;
            case 'custom':
                startStr = customStart;
                endStr = customEnd;
                break;
            default:
                startStr = format(subDays(now, 6), 'yyyy-MM-dd');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch(`${API_BASE}/consult`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: startStr,
                    endDate: endStr,
                    language
                }),
                signal: controller.signal,
            });

            if (res.ok) {
                const advice = await res.text();
                setAiAdvice(advice);
            } else {
                setError("Failed to get AI advice");
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') {
                setError("Request timed out. Try a shorter date range.");
            } else {
                console.error(err);
                setError("AI Consultant unavailable");
            }
        } finally {
            clearTimeout(timeout);
            setAiLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const res = await fetch(`${API_BASE}/export`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Export failed");
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `Calorie_Track_Export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Missing token or server error";
            console.error("Export error:", err);
            setError("Failed to export: " + message);
        }
    };

    useEffect(() => {
        if (dashboardData) {
            if (dashboardData.goals) setGoals({ calories: dashboardData.goals.calories || 2000, protein: dashboardData.goals.protein || 150, carbs: dashboardData.goals.carbs || 250, fat: dashboardData.goals.fat || 70 });
            if (dashboardData.user) setUser(dashboardData.user);
            setFoods(dashboardData.todayFoods || []);
            setWeights(dashboardData.weightRecent || []);
            setMeasurements(dashboardData.measurementsRecent || []);
            setExercises(dashboardData.exerciseRecent || []);
            setSleeps(dashboardData.sleepRecent || []);
            setLoading(false);
        }
        if (dashboardError) {
            setError("Failed to reach the server.");
            setLoading(false);
        }
    }, [dashboardData, dashboardError]);

    const chartData = useMemo(() => {
        if (!foods.length) return [];
        const grouped = foods.reduce<Record<string, { date: string; sortKey: string; calories: number; protein: number; carbs: number; fat: number }>>((acc, food) => {
            const dateObj = new Date(food.date);
            const dateStr = format(dateObj, 'MMM dd');
            const sortKey = format(dateObj, 'yyyy-MM-dd');
            if (!acc[sortKey]) acc[sortKey] = { date: dateStr, sortKey: sortKey, calories: 0, protein: 0, carbs: 0, fat: 0 };
            acc[sortKey].calories += food.calories;
            acc[sortKey].protein += food.protein;
            acc[sortKey].carbs += (food.carbs || 0);
            acc[sortKey].fat += (food.fat || 0);
            return acc;
        }, {});

        if (range === 'week' || range === 'month' || (range === 'custom' && customStart && customEnd)) {
            const start = range === 'week' ? startOfDay(subDays(new Date(), 6)) : range === 'month' ? startOfDay(subDays(new Date(), 29)) : startOfDay(new Date(customStart));
            const end = range === 'custom' ? endOfDay(new Date(customEnd)) : endOfDay(new Date());
            const allDays = eachDayOfInterval({ start, end });
            return allDays.map(d => {
                const sortKey = format(d, 'yyyy-MM-dd');
                return grouped[sortKey] || { date: format(d, 'MMM dd'), sortKey, calories: 0, protein: 0, carbs: 0, fat: 0 };
            });
        }
        return Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [foods, range, customStart, customEnd]);

    const chartDataMeasurements = useMemo(() => {
        if (!measurements.length) return [];
        return measurements.map(m => ({
            date: format(new Date(m.date), 'MMM dd'),
            sortKey: format(new Date(m.date), 'yyyy-MM-dd'),
            weight: m.weight,
            waist: m.waistCircumference,
            bodyFat: m.bodyFatPercentage
        })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [measurements]);

    const chartDataExercise = useMemo(() => {
        if (!exercises.length) return [];
        const grouped = exercises.reduce<Record<string, { date: string; sortKey: string; duration: number; calories: number }>>((acc, ex) => {
            const dateObj = new Date(ex.date);
            const dateStr = format(dateObj, 'MMM dd');
            const sortKey = format(dateObj, 'yyyy-MM-dd');
            if (!acc[sortKey]) acc[sortKey] = { date: dateStr, sortKey, duration: 0, calories: 0 };
            acc[sortKey].duration += ex.durationMinutes;
            acc[sortKey].calories += (ex.caloriesBurned || 0);
            return acc;
        }, {});

        if (range === 'week' || range === 'month' || (range === 'custom' && customStart && customEnd)) {
            const start = range === 'week' ? startOfDay(subDays(new Date(), 6)) : range === 'month' ? startOfDay(subDays(new Date(), 29)) : startOfDay(new Date(customStart));
            const end = range === 'custom' ? endOfDay(new Date(customEnd)) : endOfDay(new Date());
            const allDays = eachDayOfInterval({ start, end });
            return allDays.map(d => {
                const sortKey = format(d, 'yyyy-MM-dd');
                return grouped[sortKey] || { date: format(d, 'MMM dd'), sortKey, duration: 0, calories: 0 };
            });
        }
        return Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [exercises, range, customStart, customEnd]);

    const chartDataSleep = useMemo(() => {
        if (!sleeps.length) return [];
        const grouped = sleeps.reduce<Record<string, { date: string; sortKey: string; duration: number; quality: string }>>((acc, sl) => {
            const dateObj = new Date(sl.date);
            const dateStr = format(dateObj, 'MMM dd');
            const sortKey = format(dateObj, 'yyyy-MM-dd');
            if (!acc[sortKey]) acc[sortKey] = { date: dateStr, sortKey, duration: 0, quality: sl.quality || 'Good' };
            acc[sortKey].duration = sl.durationHours;
            acc[sortKey].quality = sl.quality || 'Good';
            return acc;
        }, {});

        if (range === 'week' || range === 'month' || (range === 'custom' && customStart && customEnd)) {
            const start = range === 'week' ? startOfDay(subDays(new Date(), 6)) : range === 'month' ? startOfDay(subDays(new Date(), 29)) : startOfDay(new Date(customStart));
            const end = range === 'custom' ? endOfDay(new Date(customEnd)) : endOfDay(new Date());
            const allDays = eachDayOfInterval({ start, end });
            return allDays.map(d => {
                const sortKey = format(d, 'yyyy-MM-dd');
                return grouped[sortKey] || { date: format(d, 'MMM dd'), sortKey, duration: 0, quality: 'N/A' };
            });
        }
        return Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [sleeps, range, customStart, customEnd]);

    const avgExerciseMinutes = chartDataExercise.length
        ? Math.round(chartDataExercise.reduce((sum, d) => sum + (d.duration || 0), 0) / chartDataExercise.length)
        : 0;

    const avgSleepHours = chartDataSleep.filter(d => d.duration > 0).length
        ? (chartDataSleep.reduce((sum, d) => sum + (d.duration || 0), 0) / chartDataSleep.filter(d => d.duration > 0).length).toFixed(1)
        : 0;

    const avgCalories = chartData.length
        ? Math.round(chartData.reduce((sum, d) => sum + (d.calories || 0), 0) / chartData.length)
        : 0;
    const avgProtein = chartData.length
        ? Math.round(chartData.reduce((sum, d) => sum + (d.protein || 0), 0) / chartData.length)
        : 0;
    const avgCarbs = chartData.length
        ? Math.round(chartData.reduce((sum, d) => sum + (d.carbs || 0), 0) / chartData.length)
        : 0;
    const avgFat = chartData.length
        ? Math.round(chartData.reduce((sum, d) => sum + (d.fat || 0), 0) / chartData.length)
        : 0;
    const latestMeasurement = chartDataMeasurements.length ? chartDataMeasurements[chartDataMeasurements.length - 1] : null;

    const lastUpdatedLabel = t('chartLastUpdated');
    const noDataLabel = t('chartNoData');
    const energyLabel = t('chartEnergy');
    const macroLabel = t('chartMacros');
    const bodyLabel = t('chartBody');
    const avgLabel = t('chartAvg');
    const goalLabel = t('chartGoal');
    const calorieTitle = t('chartCaloriesTitle');
    const proteinTitle = t('chartProteinTitle');
    const fatTitle = t('chartFatTitle');
    const carbsTitle = t('chartCarbsTitle');
    const exerciseLabel = t('chartExercise');
    const sleepLabel = t('chartSleep');
    const exerciseTitle = t('chartExerciseTitle');
    const sleepTitle = t('chartSleepTitle');
    const rangeLabels: Record<RangeType, string> = {
        today: t('rangeToday'),
        week: t('rangeWeek'),
        month: t('rangeMonth'),
        custom: t('rangeCustom'),
    };
    const selectedRangeLabel =
        range === 'custom'
            ? `${format(new Date(customStart), 'MMM d')} - ${format(new Date(customEnd), 'MMM d')}`
            : rangeLabels[range];
    const currentMacroTheme =
        macroView === 'protein'
            ? DASHBOARD_THEME.macroProtein
            : macroView === 'carbs'
                ? DASHBOARD_THEME.macroCarbs
                : DASHBOARD_THEME.macroFat;
    const currentMacroPanelClass =
        macroView === 'protein'
            ? 'chart-panel--macro-protein'
            : macroView === 'carbs'
                ? 'chart-panel--macro-carbs'
                : 'chart-panel--macro-fat';
    const currentHealthTheme = healthView === 'exercise' ? DASHBOARD_THEME.fitness : DASHBOARD_THEME.recovery;
    const currentMeasureTheme =
        measureView === 'weight'
            ? DASHBOARD_THEME.nutrition
            : measureView === 'waist'
                ? DASHBOARD_THEME.protein
                : DASHBOARD_THEME.recovery;

    if (dashboardLoading || loading) {
        return (
            <div className="page-shell">
                <div className="floating-blob floating-blob-1" />
                <div className="floating-blob floating-blob-2" />
                <div className="floating-blob floating-blob-3" />
                <div className="app-container">
                    <PageHeader
                        title={t('analyticsTitle')}
                        subtitle={t('historyTrends')}
                        backHref="/"
                        backLabel={t('back')}
                    />
                    <div className="responsive-layout">
                        <SkeletonChart />
                        <SkeletonChart />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell">
            <div className="floating-blob floating-blob-1" />
            <div className="floating-blob floating-blob-2" />
            <div className="floating-blob floating-blob-3" />
            <div className="app-container">
                <PageHeader
                    title={user?.name ? `${user.name}'s ${t('navDashboard')}` : t('analyticsTitle')}
                    subtitle={t('historyTrends')}
                    backHref="/"
                    backLabel={t('back')}
                    actions={
                        <>
                            <button
                                onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
                                className="icon-btn mobile-hidden"
                                style={{ fontSize: '14px', fontWeight: 'bold' }}
                                aria-label={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
                            >
                                {language === 'en' ? 'TH' : 'EN'}
                            </button>
                            <Link href="/player-card" className="icon-btn mobile-hidden" title="Player Card" aria-label="Player Card">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                            </Link>
                            <button onClick={logout} className="icon-btn mobile-hidden" style={{ color: "var(--danger)" }} aria-label={t('logout')}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        </>
                    }
                />

                <section className="glass-panel range-selector">
                    <div className="range-selector-top">
                        <div className="range-selector-copy">
                            <p className="range-selector-label">{t('rangeSelectorLabel')}</p>
                            <p className="range-selector-hint">{t('rangeSelectorHint')}</p>
                        </div>
                        <div className="range-selector-chip">
                            <span>{t('selectedWindow')}</span>
                            <strong>{selectedRangeLabel}</strong>
                        </div>
                    </div>
                    <div className="range-selector-tabs">
                        {(['today', 'week', 'month', 'custom'] as RangeType[]).map(r => (
                            <button 
                                key={r} 
                                className={`range-btn ${range === r ? 'active' : ''}`} 
                                onClick={() => setRange(r)}
                            >
                                {rangeLabels[r]}
                            </button>
                        ))}
                    </div>
                    {range === 'custom' && (
                        <div className="range-selector-dates">
                            <label className="range-date-field">
                                <span className="range-date-label">{t('startDate')}</span>
                                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="date-input" />
                            </label>
                            <label className="range-date-field">
                                <span className="range-date-label">{t('endDate')}</span>
                                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="date-input" />
                            </label>
                        </div>
                    )}
                </section>

                <section className="glass-panel dashboard-insight-card">
                    <div className="dashboard-insight-header">
                        <div className="dashboard-insight-copy">
                            <div className="dashboard-insight-title-row">
                                <div className="dashboard-insight-icon" style={{ background: `linear-gradient(135deg, ${DASHBOARD_THEME.nutrition.gradientStart}, ${DASHBOARD_THEME.nutrition.gradientEnd})`, boxShadow: `0 10px 24px ${DASHBOARD_THEME.nutrition.glow}` }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 12L2.7 16.5"></path></svg>
                                </div>
                                <div>
                                    <p className="dashboard-insight-eyebrow">{t('aiBriefing')}</p>
                                    <h3 className="dashboard-insight-title">{t('aiAnalyst')}</h3>
                                </div>
                            </div>
                            <p className="dashboard-insight-hint">{t('aiAnalystHint')}</p>
                        </div>
                        <div className="dashboard-insight-actions">
                            <div className="dashboard-insight-window">
                                <span>{t('selectedWindow')}</span>
                                <strong>{selectedRangeLabel}</strong>
                            </div>
                            <button onClick={handleGetAiAdvice} className="primary-btn dashboard-insight-btn" disabled={aiLoading || loading}>{aiLoading ? t('analyzing') : t('getInsights')}</button>
                        </div>
                    </div>
                    {aiAdvice && (
                        <div className="markdown-content dashboard-insight-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAdvice}</ReactMarkdown>
                        </div>
                    )}
                </section>

                {error && <div className="glass-panel" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--danger)", padding: "12px", borderRadius: "12px", color: "white", textAlign: 'center' }}>{error}</div>}

                <div className="responsive-layout">
                    <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                        <defs>
                            <linearGradient id="cal-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.nutrition.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.nutrition.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="pro-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.macroProtein.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.macroProtein.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="carb-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.macroCarbs.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.macroCarbs.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fat-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.macroFat.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.macroFat.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="cal-danger" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.danger.solid} stopOpacity={0.9} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.danger.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="ex-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.fitness.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.fitness.solid} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="sleep-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={DASHBOARD_THEME.recovery.solid} stopOpacity={0.85} />
                                <stop offset="95%" stopColor={DASHBOARD_THEME.recovery.solid} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                    </svg>
                    
                    <div className="glass-panel chart-panel chart-panel--nutrition chart-panel--energy" style={{ height: '320px', gridColumn: '1 / -1' }}>
                        <div className="chart-header">
                            <div>
                                <p className="chart-eyebrow">{energyLabel}</p>
                                <h3 className="chart-title">{calorieTitle}</h3>
                                <p className="chart-subtitle">{avgLabel} {avgCalories} kcal/{t('unitDay')}</p>
                            </div>
                            <div className="chart-kpi">
                                <span className="chart-kpi-label">{goalLabel}</span>
                                <span className="chart-kpi-value">{goals.calories} kcal</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="75%">
                            <BarChart data={chartData} barCategoryGap="22%">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, (dataMax: number) => Math.max(dataMax, goals.calories) * 1.1]} />
                                <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: 'rgba(15, 23, 21, 0.9)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                <ReferenceLine y={goals.calories} stroke={DASHBOARD_THEME.nutrition.solid} strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: DASHBOARD_THEME.nutrition.solid, fontSize: 10, fontWeight: 700 }} />
                                {avgCalories > 0 && (
                                    <ReferenceLine y={avgCalories} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 6" label={{ position: 'left', value: avgLabel, fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700 }} />
                                )}
                                <Bar dataKey="calories" radius={[8, 8, 4, 4]} maxBarSize={44}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.calories > goals.calories ? 'url(#cal-danger)' : 'url(#cal-gradient)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={`glass-panel chart-panel chart-panel--macro-section ${currentMacroPanelClass}`} style={{ height: '320px', gridColumn: '1 / -1' }}>
                        <div className="chart-header">
                            <div>
                                <p className="chart-eyebrow">{macroLabel}</p>
                                <h3 className="chart-title">{macroView === 'protein' ? proteinTitle : macroView === 'carbs' ? carbsTitle : fatTitle}</h3>
                                <p className="chart-subtitle">{avgLabel} {macroView === 'protein' ? avgProtein : macroView === 'carbs' ? avgCarbs : avgFat} g/{t('unitDay')}</p>
                            </div>
                            <div className="chart-toggle">
                                <button
                                    onClick={() => setMacroView('protein')}
                                    className={`glass-btn ${macroView === 'protein' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(macroView === 'protein', DASHBOARD_THEME.macroProtein.solid, DASHBOARD_THEME.macroProtein.glow)}
                                >
                                    {t('protein').toUpperCase()}
                                </button>
                                <button
                                    onClick={() => setMacroView('carbs')}
                                    className={`glass-btn ${macroView === 'carbs' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(macroView === 'carbs', DASHBOARD_THEME.macroCarbs.solid, DASHBOARD_THEME.macroCarbs.glow)}
                                >
                                    {t('carbs').toUpperCase()}
                                </button>
                                <button
                                    onClick={() => setMacroView('fat')}
                                    className={`glass-btn ${macroView === 'fat' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(macroView === 'fat', DASHBOARD_THEME.macroFat.solid, DASHBOARD_THEME.macroFat.glow)}
                                >
                                    {t('fat').toUpperCase()}
                                </button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="75%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, (dataMax: number) => Math.max(dataMax, macroView === 'protein' ? goals.protein : macroView === 'carbs' ? goals.carbs : goals.fat) * 1.2]} />
                                <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: 'rgba(15, 23, 21, 0.9)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                <ReferenceLine
                                    y={macroView === 'protein' ? goals.protein : macroView === 'carbs' ? goals.carbs : goals.fat}
                                    stroke={currentMacroTheme.solid}
                                    strokeDasharray="4 4"
                                    label={{ position: 'right', value: `${macroView.toUpperCase()} ${goalLabel}`, fill: currentMacroTheme.solid, fontSize: 10, fontWeight: 700 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={macroView}
                                    stroke={currentMacroTheme.solid}
                                    strokeWidth={3}
                                    dot={{ fill: 'var(--bg-color)', r: 4, strokeWidth: 2, stroke: currentMacroTheme.solid }}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#0f1715', fill: currentMacroTheme.solid }}
                                    animationDuration={1000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={`glass-panel chart-panel chart-panel--health-section ${healthView === 'exercise' ? 'chart-panel--fitness' : 'chart-panel--recovery'}`} style={{ height: '320px', gridColumn: '1 / -1' }}>
                        <div className="chart-header">
                            <div>
                                <p className="chart-eyebrow">{healthView === 'exercise' ? exerciseLabel : sleepLabel}</p>
                                <h3 className="chart-title">{healthView === 'exercise' ? exerciseTitle : sleepTitle}</h3>
                                <p className="chart-subtitle">
                                    {healthView === 'exercise'
                                        ? `${avgLabel} ${avgExerciseMinutes} ${t('unitMin')}/${t('unitDay')}`
                                        : `${avgLabel} ${avgSleepHours} ${t('unitHr')}/${t('unitDay')}`}
                                </p>
                            </div>
                            <div className="chart-actions">
                                <div className="chart-toggle">
                                    <button
                                        onClick={() => setHealthView('exercise')}
                                        className={`glass-btn ${healthView === 'exercise' ? 'active' : ''}`}
                                        style={getToggleButtonStyle(healthView === 'exercise', DASHBOARD_THEME.fitness.solid, DASHBOARD_THEME.fitness.glow)}
                                    >
                                        {exerciseLabel.toUpperCase()}
                                    </button>
                                    <button
                                        onClick={() => setHealthView('sleep')}
                                        className={`glass-btn ${healthView === 'sleep' ? 'active' : ''}`}
                                        style={getToggleButtonStyle(healthView === 'sleep', DASHBOARD_THEME.recovery.solid, DASHBOARD_THEME.recovery.glow)}
                                    >
                                        {sleepLabel.toUpperCase()}
                                    </button>
                                </div>
                                <div className="chart-kpi">
                                    <span className="chart-kpi-label">{goalLabel}</span>
                                    <span className="chart-kpi-value">{healthView === 'exercise' ? `30 ${t('unitMin')}` : `8 ${t('unitHr')}`}</span>
                                </div>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="75%">
                            {healthView === 'exercise' ? (
                                <BarChart data={chartDataExercise} barCategoryGap="22%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: 'rgba(15, 23, 21, 0.9)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                    <ReferenceLine y={30} stroke={DASHBOARD_THEME.fitness.solid} strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: DASHBOARD_THEME.fitness.solid, fontSize: 10, fontWeight: 700 }} />
                                    <Bar dataKey="duration" name={t('minutes')} fill="url(#ex-gradient)" radius={[8, 8, 4, 4]} maxBarSize={44} />
                                </BarChart>
                            ) : (
                                <BarChart data={chartDataSleep} barCategoryGap="22%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 12]} />
                                    <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: 'rgba(15, 23, 21, 0.9)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                    <ReferenceLine y={8} stroke={DASHBOARD_THEME.recovery.solid} strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: DASHBOARD_THEME.recovery.solid, fontSize: 10, fontWeight: 700 }} />
                                    <Bar dataKey="duration" name={t('hours')} radius={[8, 8, 4, 4]} maxBarSize={44}>
                                        {chartDataSleep.map((entry, index) => {
                                            let color = 'url(#sleep-gradient)';
                                            if (entry.quality === 'Poor') color = 'var(--danger)';
                                            if (entry.quality === 'Fair') color = DASHBOARD_THEME.carbs.solid;
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>

                    <div className={`glass-panel chart-panel chart-panel--body-section ${measureView === 'weight' ? 'chart-panel--nutrition' : measureView === 'waist' ? 'chart-panel--protein' : 'chart-panel--recovery'}`} style={{ height: '340px', gridColumn: '1 / -1' }}>
                        <div className="chart-header chart-header--wrap">
                            <div>
                                <p className="chart-eyebrow">{bodyLabel}</p>
                                <h3 className="chart-title">{t('measurementsTrend')}</h3>
                                <p className="chart-subtitle">
                                    {latestMeasurement
                                        ? `${lastUpdatedLabel} ${latestMeasurement.date}`
                                        : noDataLabel}
                                </p>
                            </div>
                            <div className="chart-toggle">
                                <button
                                    onClick={() => setMeasureView('weight')}
                                    className={`glass-btn ${measureView === 'weight' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(measureView === 'weight', DASHBOARD_THEME.nutrition.solid, DASHBOARD_THEME.nutrition.glow)}
                                >
                                    {t('weight')}
                                </button>
                                <button
                                    onClick={() => setMeasureView('waist')}
                                    className={`glass-btn ${measureView === 'waist' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(measureView === 'waist', DASHBOARD_THEME.protein.solid, DASHBOARD_THEME.protein.glow)}
                                >
                                    {t('waist')}
                                </button>
                                <button
                                    onClick={() => setMeasureView('bodyFat')}
                                    className={`glass-btn ${measureView === 'bodyFat' ? 'active' : ''}`}
                                    style={getToggleButtonStyle(measureView === 'bodyFat', DASHBOARD_THEME.recovery.solid, DASHBOARD_THEME.recovery.glow)}
                                >
                                    {t('bodyFat')}
                                </button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height="70%">
                            <LineChart data={chartDataMeasurements}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', borderRadius: '12px' }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={measureView}
                                    name={measureView === 'weight' ? `${t('weight')} (kg)` : measureView === 'waist' ? `${t('waist')} (cm)` : `${t('bodyFat')} (%)`}
                                    stroke={currentMeasureTheme.solid}
                                    strokeWidth={3}
                                    dot={{ fill: 'var(--bg-color)', r: 4, strokeWidth: 2, stroke: currentMeasureTheme.solid }}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#0f1715', fill: currentMeasureTheme.solid }}
                                    animationDuration={1000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <section style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '32px' }}>
                    <button onClick={handleExport} className="primary-btn outline" style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export Data (CSV)
                    </button>
                </section>
            </div>
        </div>
    );
}
