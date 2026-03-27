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
    Cell
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
    const [weightInput, setWeightInput] = useState<string>('');

    const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
    const [measurementInput, setMeasurementInput] = useState({ weight: '', waist: '', bodyFat: '' });
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUrl, setPhotoUrl] = useState('');

    const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
    const [exerciseInput, setExerciseInput] = useState({ name: '', durationMinutes: 30, caloriesBurned: 0 });

    const [sleeps, setSleeps] = useState<SleepRecord[]>([]);
    const [sleepInput, setSleepInput] = useState({ durationHours: 8, durationMinutes: 0, quality: 'Good' });

    const [customStart, setCustomStart] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [aiLoading, setAiLoading] = useState(false);
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);
    const [macroView, setMacroView] = useState<'protein' | 'carbs' | 'fat'>('protein');
    const [measureView, setMeasureView] = useState<'weight' | 'waist' | 'bodyFat'>('weight');
    const [healthView, setHealthView] = useState<'exercise' | 'sleep'>('exercise');
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        measurements: false,
        exercise: false,
        sleep: false
    });

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

        try {
            const res = await fetch(`${API_BASE}/consult`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: startStr,
                    endDate: endStr,
                    language
                }),
            });

            if (res.ok) {
                const advice = await res.text();
                setAiAdvice(advice);
            } else {
                setError("Failed to get AI advice");
            }
        } catch (err) {
            console.error(err);
            setError("AI Consultant unavailable");
        } finally {
            setAiLoading(false);
        }
    };

    const handleLogWeight = async () => {
        const w = parseFloat(weightInput);
        if (isNaN(w) || w <= 0) return;

        try {
            const res = await fetch(`${API_BASE}/weight`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weight: w,
                    date: new Date().toISOString()
                })
            });

            if (res.ok) {
                setWeightInput('');
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setPhotoUrl(data.url);
            } else {
                setError("Failed to upload photo");
            }
        } catch (err) {
            console.error(err);
            setError("Error uploading photo");
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleLogMeasurement = async () => {
        const w = parseFloat(measurementInput.weight);
        const waist = parseFloat(measurementInput.waist);
        const bf = parseFloat(measurementInput.bodyFat);

        if (isNaN(w) || w <= 0) {
            setError("Please enter a valid weight");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/measurements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weight: w,
                    waistCircumference: isNaN(waist) ? 0 : waist,
                    bodyFatPercentage: isNaN(bf) ? 0 : bf,
                    progressPhotoUrl: photoUrl,
                    date: new Date().toISOString()
                })
            });

            if (res.ok) {
                setMeasurementInput({ weight: '', waist: '', bodyFat: '' });
                setPhotoUrl('');
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogExercise = async () => {
        if (!exerciseInput.name) {
            setError("Please enter an activity name.");
            return;
        }
        if (!exerciseInput.durationMinutes || exerciseInput.durationMinutes <= 0 || isNaN(exerciseInput.durationMinutes)) {
            setError("Please enter a valid duration.");
            return;
        }
        try {
            setError(null);
            const res = await fetch(`${API_BASE}/exercise`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(exerciseInput)
            });
            if (res.ok) {
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
                setExerciseInput({ name: '', durationMinutes: 30, caloriesBurned: 0 });
            } else {
                setError("Failed to save activity.");
            }
        } catch (err) {
            console.error(err);
            setError("Error saving activity.");
        }
    };

    const handleLogSleep = async () => {
        if (!sleepInput.durationHours || sleepInput.durationHours <= 0 || isNaN(sleepInput.durationHours)) {
            setError("Please enter valid sleep hours.");
            return;
        }
        try {
            setError(null);
            const yesterday = subDays(new Date(), 1).toISOString();
            const totalHours = Number(sleepInput.durationHours) + (Number(sleepInput.durationMinutes) / 60);
            const res = await fetch(`${API_BASE}/sleep`, {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    durationHours: totalHours,
                    quality: sleepInput.quality,
                    date: yesterday
                })
            });
            if (res.ok) {
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
                setSleepInput({ durationHours: 8, durationMinutes: 0, quality: 'Good' });
            } else {
                setError("Failed to save sleep data.");
            }
        } catch (err) {
            console.error(err);
            setError("Error saving sleep data.");
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

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };
    
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
                                className="icon-btn"
                                style={{ fontSize: '14px', fontWeight: 'bold' }}
                                aria-label={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
                            >
                                {language === 'en' ? 'TH' : 'EN'}
                            </button>
                            <Link href="/player-card" className="icon-btn" title="Player Card" aria-label="Player Card">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                            </Link>
                            <button onClick={logout} className="icon-btn" style={{ color: "var(--danger)" }} aria-label={t('logout')}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        </>
                    }
                />

                <section className="glass-panel range-selector" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '0', flexWrap: 'wrap' }}>
                        {(['today', 'week', 'month', 'custom'] as RangeType[]).map(r => (
                            <button 
                                key={r} 
                                className={`range-btn ${range === r ? 'active' : ''}`} 
                                onClick={() => setRange(r)}
                            >
                                {r === 'today' ? 'Today' : r === 'week' ? '7 Days' : r === 'month' ? '30 Days' : 'Custom'}
                            </button>
                        ))}
                    </div>
                    {range === 'custom' && (
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="date-input" />
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="date-input" />
                        </div>
                    )}
                </section>

                <section className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="icon-btn" style={{ background: 'var(--accent-cal-gradient)', border: 'none', width: '40px', height: '40px' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 12L2.7 16.5"></path></svg>
                            </div>
                            <h3 style={{ margin: 0, fontSize: '17px', color: 'var(--text-primary)' }}>{t('aiAnalyst')}</h3>
                        </div>
                        <button onClick={handleGetAiAdvice} className="primary-btn active" disabled={aiLoading || loading} style={{ margin: 0, padding: '10px 20px', fontSize: '14px' }}>{aiLoading ? t('analyzing') : t('getInsights')}</button>
                    </div>
                    {aiAdvice && (
                        <div className="markdown-content" style={{ fontSize: '14px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '20px', borderLeft: '4px solid var(--accent-cal)', marginTop: '16px' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAdvice}</ReactMarkdown>
                        </div>
                    )}
                </section>

                {error && <div className="glass-panel" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid var(--danger)", padding: "12px", borderRadius: "12px", color: "white", textAlign: 'center' }}>{error}</div>}

                <div className="responsive-layout">
                    <svg style={{ height: 0, width: 0, position: 'absolute' }}>
                        <defs>
                            <linearGradient id="cal-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-cal)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--accent-cal)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="pro-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-pro)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--accent-pro)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="fat-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-fat)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--accent-fat)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="cal-danger" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.9} />
                                <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="ex-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-carb)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--accent-carb)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="sleep-gradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-pro)" stopOpacity={0.85} />
                                <stop offset="95%" stopColor="var(--accent-pro)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                    </svg>
                    
                    <div className="glass-panel chart-panel" style={{ height: '320px', gridColumn: '1 / -1' }}>
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
                                <ReferenceLine y={goals.calories} stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: 'var(--danger)', fontSize: 10, fontWeight: 700 }} />
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

                    <div className="glass-panel chart-panel" style={{ height: '320px', gridColumn: '1 / -1' }}>
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
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                                >
                                    {t('protein').toUpperCase()}
                                </button>
                                <button
                                    onClick={() => setMacroView('carbs')}
                                    className={`glass-btn ${macroView === 'carbs' ? 'active' : ''}`}
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                                >
                                    {t('carbs').toUpperCase()}
                                </button>
                                <button
                                    onClick={() => setMacroView('fat')}
                                    className={`glass-btn ${macroView === 'fat' ? 'active' : ''}`}
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
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
                                    stroke={macroView === 'protein' ? "var(--accent-pro)" : macroView === 'carbs' ? "var(--accent-carb)" : "var(--accent-fat)"}
                                    strokeDasharray="4 4"
                                    label={{ position: 'right', value: `${macroView.toUpperCase()} ${goalLabel}`, fill: macroView === 'protein' ? "var(--accent-pro)" : macroView === 'carbs' ? "var(--accent-carb)" : "var(--accent-fat)", fontSize: 10, fontWeight: 700 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={macroView}
                                    stroke={macroView === 'protein' ? "var(--accent-pro)" : macroView === 'carbs' ? "var(--accent-carb)" : "var(--accent-fat)"}
                                    strokeWidth={3}
                                    dot={{ fill: 'var(--bg-color)', r: 4, strokeWidth: 2, stroke: macroView === 'protein' ? 'var(--accent-pro)' : macroView === 'carbs' ? 'var(--accent-carb)' : 'var(--accent-fat)' }}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#0f1715', fill: macroView === 'protein' ? 'var(--accent-pro)' : macroView === 'carbs' ? 'var(--accent-carb)' : 'var(--accent-fat)' }}
                                    animationDuration={1000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="glass-panel chart-panel" style={{ height: '320px', gridColumn: '1 / -1' }}>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="chart-toggle">
                                    <button
                                        onClick={() => setHealthView('exercise')}
                                        className={`glass-btn ${healthView === 'exercise' ? 'active' : ''}`}
                                        style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                                    >
                                        {exerciseLabel.toUpperCase()}
                                    </button>
                                    <button
                                        onClick={() => setHealthView('sleep')}
                                        className={`glass-btn ${healthView === 'sleep' ? 'active' : ''}`}
                                        style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
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
                                    <ReferenceLine y={30} stroke="var(--accent-carb)" strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: 'var(--accent-carb)', fontSize: 10, fontWeight: 700 }} />
                                    <Bar dataKey="duration" name={t('minutes')} fill="url(#ex-gradient)" radius={[8, 8, 4, 4]} maxBarSize={44} />
                                </BarChart>
                            ) : (
                                <BarChart data={chartDataSleep} barCategoryGap="22%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 12]} />
                                    <Tooltip wrapperClassName="chart-tooltip" contentStyle={{ background: 'rgba(15, 23, 21, 0.9)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '14px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                                    <ReferenceLine y={8} stroke="var(--accent-pro)" strokeDasharray="4 4" label={{ position: 'right', value: goalLabel, fill: 'var(--accent-pro)', fontSize: 10, fontWeight: 700 }} />
                                    <Bar dataKey="duration" name={t('hours')} radius={[8, 8, 4, 4]} maxBarSize={44}>
                                        {chartDataSleep.map((entry, index) => {
                                            let color = 'url(#sleep-gradient)';
                                            if (entry.quality === 'Poor') color = 'var(--danger)';
                                            if (entry.quality === 'Fair') color = 'var(--accent-carb)';
                                            return <Cell key={`cell-${index}`} fill={color} />;
                                        })}
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>

                    <div className="glass-panel chart-panel" style={{ height: '340px', gridColumn: '1 / -1' }}>
                        <div className="chart-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
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
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                                >
                                    {t('weight')}
                                </button>
                                <button
                                    onClick={() => setMeasureView('waist')}
                                    className={`glass-btn ${measureView === 'waist' ? 'active' : ''}`}
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                                >
                                    {t('waist')}
                                </button>
                                <button
                                    onClick={() => setMeasureView('bodyFat')}
                                    className={`glass-btn ${measureView === 'bodyFat' ? 'active' : ''}`}
                                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
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
                                    stroke={measureView === 'weight' ? "var(--accent-cal)" : measureView === 'waist' ? "var(--accent-pro)" : "var(--accent-fat)"}
                                    strokeWidth={3}
                                    dot={{ fill: 'var(--bg-color)', r: 4, strokeWidth: 2, stroke: measureView === 'weight' ? 'var(--accent-cal)' : measureView === 'waist' ? 'var(--accent-pro)' : 'var(--accent-fat)' }}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#0f1715', fill: measureView === 'weight' ? 'var(--accent-cal)' : measureView === 'waist' ? 'var(--accent-pro)' : 'var(--accent-fat)' }}
                                    animationDuration={1000}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="glass-panel logging-section" style={{ padding: '24px', gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('logMeasurements')}</h2>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => setExpandedSections({ measurements: true, exercise: true, sleep: true })}
                                    className="glass-btn"
                                    style={{ padding: '8px 16px', fontSize: '12px' }}
                                >
                                    Expand All
                                </button>
                                <button
                                    onClick={() => setExpandedSections({ measurements: false, exercise: false, sleep: false })}
                                    className="glass-btn"
                                    style={{ padding: '8px 16px', fontSize: '12px' }}
                                >
                                    Collapse All
                                </button>
                            </div>
                        </div>

                        <div className="accordion-container">
                            {/* Measurements Accordion */}
                            <div className="accordion-item">
                                <button
                                    onClick={() => toggleSection('measurements')}
                                    className={`accordion-header ${expandedSections.measurements ? 'active' : ''}`}
                                >
                                    <div className="accordion-header-content">
                                        <div className="accordion-icon" style={{ background: 'var(--accent-cal-gradient)' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v20M2 12h20M7 7l10 10M17 7L7 17"/></svg>
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{t('logMeasurements')}</h3>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                {measurements.length > 0 ? `${measurements.length} records` : t('chartNoData')}
                                            </p>
                                        </div>
                                    </div>
                                    <svg
                                        className={`accordion-chevron ${expandedSections.measurements ? 'rotated' : ''}`}
                                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                <div className={`accordion-content ${expandedSections.measurements ? 'expanded' : ''}`}>
                                    <div className="accordion-content-inner">
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                            <div className="input-with-unit">
                                                <label>{t('weight')}</label>
                                                <input type="number" placeholder="0.0" value={measurementInput.weight} onChange={e => setMeasurementInput({ ...measurementInput, weight: e.target.value })} />
                                                <span className="unit">KG</span>
                                            </div>
                                            <div className="input-with-unit">
                                                <label>{t('waist')}</label>
                                                <input type="number" placeholder="0.0" value={measurementInput.waist} onChange={e => setMeasurementInput({ ...measurementInput, waist: e.target.value })} />
                                                <span className="unit">CM</span>
                                            </div>
                                        </div>
                                        <div className="input-with-unit" style={{ marginBottom: '16px' }}>
                                            <label>{t('bodyFat')}</label>
                                            <input type="number" placeholder="0.0" value={measurementInput.bodyFat} onChange={e => setMeasurementInput({ ...measurementInput, bodyFat: e.target.value })} />
                                            <span className="unit">%</span>
                                        </div>
                                        <button onClick={handleLogMeasurement} className="primary-btn active compact-btn">{t('saveMeasurements')}</button>

                                        <div className="mini-history">
                                            <h4>{t('recentHistory')}</h4>
                                            {measurements.slice(0, 2).map((m, idx) => (
                                                <div key={idx} className="mini-history-item">
                                                    <span className="mini-date">{format(new Date(m.date), 'MMM dd')}</span>
                                                    <span className="mini-value">{m.weight} kg</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Exercise Accordion */}
                            <div className="accordion-item">
                                <button
                                    onClick={() => toggleSection('exercise')}
                                    className={`accordion-header ${expandedSections.exercise ? 'active' : ''}`}
                                >
                                    <div className="accordion-header-content">
                                        <div className="accordion-icon" style={{ background: 'var(--accent-pro-gradient)' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{t('logExercise')}</h3>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                {exercises.length > 0 ? `${exercises.length} activities` : t('chartNoData')}
                                            </p>
                                        </div>
                                    </div>
                                    <svg
                                        className={`accordion-chevron ${expandedSections.exercise ? 'rotated' : ''}`}
                                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                <div className={`accordion-content ${expandedSections.exercise ? 'expanded' : ''}`}>
                                    <div className="accordion-content-inner">
                                        <div style={{ marginBottom: '16px' }}>
                                            <label>{t('activity')}</label>
                                            <input type="text" placeholder={t('activityPlaceholder')} value={exerciseInput.name} onChange={e => setExerciseInput({ ...exerciseInput, name: e.target.value })} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                            <div>
                                                <label>{t('minutes')}</label>
                                                <input type="number" placeholder="0" value={exerciseInput.durationMinutes} onChange={e => setExerciseInput({ ...exerciseInput, durationMinutes: parseInt(e.target.value) || 0 })} />
                                            </div>
                                            <div>
                                                <label>{t('calories')}</label>
                                                <input type="number" placeholder="0" value={exerciseInput.caloriesBurned} onChange={e => setExerciseInput({ ...exerciseInput, caloriesBurned: parseInt(e.target.value) || 0 })} />
                                            </div>
                                        </div>
                                        <button onClick={handleLogExercise} className="primary-btn active compact-btn">{t('logActivityBtn')}</button>

                                        <div className="mini-history">
                                            <h4>{t('exerciseHistory')}</h4>
                                            {exercises.slice(0, 2).map((ex, idx) => (
                                                <div key={idx} className="mini-history-item">
                                                    <span className="mini-date">{format(new Date(ex.date), 'MMM dd')}</span>
                                                    <span className="mini-value">{ex.name}</span>
                                                    <span className="mini-duration">{ex.durationMinutes}min</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sleep Accordion */}
                            <div className="accordion-item">
                                <button
                                    onClick={() => toggleSection('sleep')}
                                    className={`accordion-header ${expandedSections.sleep ? 'active' : ''}`}
                                >
                                    <div className="accordion-header-content">
                                        <div className="accordion-icon" style={{ background: 'var(--accent-fat-gradient)' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{t('logSleep')}</h3>
                                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                {sleeps.length > 0 ? `${sleeps.length} records` : t('chartNoData')}
                                            </p>
                                        </div>
                                    </div>
                                    <svg
                                        className={`accordion-chevron ${expandedSections.sleep ? 'rotated' : ''}`}
                                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                    >
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>

                                <div className={`accordion-content ${expandedSections.sleep ? 'expanded' : ''}`}>
                                    <div className="accordion-content-inner">
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                                            <div>
                                                <label>{t('hours')}</label>
                                                <input type="number" placeholder="0" value={sleepInput.durationHours} onChange={e => setSleepInput({ ...sleepInput, durationHours: parseInt(e.target.value) || 0 })} />
                                            </div>
                                            <div>
                                                <label>{t('minutes')}</label>
                                                <input type="number" placeholder="0" value={sleepInput.durationMinutes} onChange={e => setSleepInput({ ...sleepInput, durationMinutes: parseInt(e.target.value) || 0 })} />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: '16px' }}>
                                            <label>{t('quality')}</label>
                                            <select value={sleepInput.quality} onChange={e => setSleepInput({ ...sleepInput, quality: e.target.value })}>
                                                <option value="Good">{t('goodQuality')}</option>
                                                <option value="Fair">{t('fairQuality')}</option>
                                                <option value="Poor">{t('poorQuality')}</option>
                                            </select>
                                        </div>
                                        <button onClick={handleLogSleep} className="primary-btn active compact-btn">{t('recordSleepBtn')}</button>

                                        <div className="mini-history">
                                            <h4>{t('sleepHistory')}</h4>
                                            {sleeps.slice(0, 2).map((sl, idx) => (
                                                <div key={idx} className="mini-history-item">
                                                    <span className="mini-date">{format(new Date(sl.date), 'MMM dd')}</span>
                                                    <span className="mini-value">{sl.durationHours} hrs</span>
                                                    <span className={`mini-quality ${sl.quality.toLowerCase()}`}>{sl.quality}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
