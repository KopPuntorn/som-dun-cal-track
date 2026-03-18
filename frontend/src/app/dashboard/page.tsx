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
    ReferenceLine
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, isBefore, eachDayOfInterval } from 'date-fns';
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

type Food = {
    id: string;
    name: string;
    calories: number;
    protein: number;
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
    const [goals, setGoals] = useState<Goals>({ calories: 2000, protein: 150, fat: 70 });
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
    const [macroView, setMacroView] = useState<'protein' | 'fat'>('protein');
    const [measureView, setMeasureView] = useState<'weight' | 'waist' | 'bodyFat'>('weight');

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
                // Also trigger main summary mutate (where no query params used for simple today summary)
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
                const newEx = await res.json();
                setExercises([newEx, ...exercises]);
                setExerciseInput({ name: '', durationMinutes: 30, caloriesBurned: 0 });
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
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
                const newSl = await res.json();
                setSleeps([newSl, ...sleeps]);
                setSleepInput({ durationHours: 8, durationMinutes: 0, quality: 'Good' });
                mutate(dashboardKey);
                mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
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
        } catch (err: any) {
            console.error("Export error:", err);
            setError("Failed to export: " + (err.message || "Missing token or server error"));
        }
    };

    useEffect(() => {
        if (dashboardData) {
            if (dashboardData.goals) setGoals({ calories: dashboardData.goals.calories || 2000, protein: dashboardData.goals.protein || 150, fat: dashboardData.goals.fat || 70 });
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
        const grouped = foods.reduce((acc, food) => {
            const dateObj = new Date(food.date);
            const dateStr = format(dateObj, 'MMM dd');
            const sortKey = format(dateObj, 'yyyy-MM-dd');
            if (!acc[sortKey]) acc[sortKey] = { date: dateStr, sortKey: sortKey, calories: 0, protein: 0, fat: 0 };
            acc[sortKey].calories += food.calories;
            acc[sortKey].protein += food.protein;
            acc[sortKey].fat += (food.fat || 0);
            return acc;
        }, {} as Record<string, any>);

        if (range === 'week' || range === 'month' || (range === 'custom' && customStart && customEnd)) {
            let start = range === 'week' ? startOfDay(subDays(new Date(), 6)) : range === 'month' ? startOfDay(subDays(new Date(), 29)) : startOfDay(new Date(customStart));
            let end = range === 'custom' ? endOfDay(new Date(customEnd)) : endOfDay(new Date());
            const allDays = eachDayOfInterval({ start, end });
            return allDays.map(d => {
                const sortKey = format(d, 'yyyy-MM-dd');
                return grouped[sortKey] || { date: format(d, 'MMM dd'), sortKey, calories: 0, protein: 0, fat: 0 };
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

    return (
        <div className="app-container">
            <header className="main-header glass-panel" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
                <Link href="/" className="icon-btn" title={t('back')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </Link>
                <div>
                    <h1 style={{ marginBottom: 0, fontSize: '24px' }}>{user?.name ? `${user.name}'s ${t('navDashboard')}` : t('analyticsTitle')}</h1>
                    <p className="date-display" style={{ marginTop: '4px' }}>{t('historyTrends')}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
                    <button onClick={() => setLanguage(language === 'en' ? 'th' : 'en')} className="icon-btn" style={{ fontSize: '14px', fontWeight: 'bold' }}>{language === 'en' ? 'TH' : 'EN'}</button>
                    <Link href="/player-card" className="icon-btn" title="Player Card">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </Link>
                    <button onClick={logout} className="icon-btn" style={{ color: "var(--danger)" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            <section className="glass-panel" style={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
                    {(['today', 'week', 'month', 'custom'] as RangeType[]).map(r => (
                        <button key={r} className={`glass-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
                    ))}
                </div>
                {range === 'custom' && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
                        <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
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
                            <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ff2a55" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="pro-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fat-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                </svg>
                <div className="glass-panel" style={{ height: '380px', gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '24px' }}>Calorie Intake vs Goal</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, (dataMax: number) => Math.max(dataMax, goals.calories) * 1.1]} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <ReferenceLine y={goals.calories} stroke="var(--danger)" strokeDasharray="4 4" label={{ position: 'right', value: 'Goal', fill: 'var(--danger)', fontSize: 10, fontWeight: 700 }} />
                            <Bar dataKey="calories" fill="url(#cal-gradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ height: '380px', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0 }}>{macroView === 'protein' ? 'Protein Trends' : 'Fat Trends'}</h3>
                        <div className="glass-panel" style={{ padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => setMacroView('protein')}
                                className={`glass-btn ${macroView === 'protein' ? 'active' : ''}`}
                                style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                            >
                                PROTEIN
                            </button>
                            <button
                                onClick={() => setMacroView('fat')}
                                className={`glass-btn ${macroView === 'fat' ? 'active' : ''}`}
                                style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                            >
                                FAT
                            </button>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} domain={[0, (dataMax: number) => Math.max(dataMax, macroView === 'protein' ? goals.protein : goals.fat) * 1.2]} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <ReferenceLine
                                y={macroView === 'protein' ? goals.protein : goals.fat}
                                stroke={macroView === 'protein' ? "var(--accent-pro)" : "var(--accent-fat)"}
                                strokeDasharray="4 4"
                                label={{ position: 'right', value: `${macroView.toUpperCase()} GOAL`, fill: macroView === 'protein' ? "var(--accent-pro)" : "var(--accent-fat)", fontSize: 10, fontWeight: 700 }}
                            />
                            <Line
                                type="monotone"
                                dataKey={macroView}
                                stroke={macroView === 'protein' ? "url(#pro-gradient)" : "url(#fat-gradient)"}
                                strokeWidth={3}
                                dot={{ fill: 'var(--bg-color)', r: 4 }}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ height: '400px', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                        <h3 style={{ margin: 0 }}>{t('measurementsTrend')}</h3>
                        <div className="glass-panel" style={{ padding: '4px', borderRadius: '12px', display: 'flex', gap: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
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
                    <ResponsiveContainer width="100%" height="75%">
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
                                stroke={measureView === 'weight' ? "#32d74b" : measureView === 'waist' ? "#bf5af2" : "#ff9f0a"}
                                strokeWidth={3}
                                dot={{ fill: 'var(--bg-color)', r: 4 }}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ padding: '24px', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
                        <div>
                            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700, opacity: 0.9 }}>{t('logMeasurements')}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>{t('weight')}</label>
                                        <input type="number" placeholder="0.0" value={measurementInput.weight} onChange={e => setMeasurementInput({ ...measurementInput, weight: e.target.value })} style={{ paddingRight: '40px', height: '48px' }} />
                                        <span style={{ position: 'absolute', right: '12px', top: '34px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>KG</span>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>{t('waist')}</label>
                                        <input type="number" placeholder="0.0" value={measurementInput.waist} onChange={e => setMeasurementInput({ ...measurementInput, waist: e.target.value })} style={{ paddingRight: '40px', height: '48px' }} />
                                        <span style={{ position: 'absolute', right: '12px', top: '34px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>CM</span>
                                    </div>
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>{t('bodyFat')}</label>
                                    <input type="number" placeholder="0.0" value={measurementInput.bodyFat} onChange={e => setMeasurementInput({ ...measurementInput, bodyFat: e.target.value })} style={{ paddingRight: '40px', height: '48px' }} />
                                    <span style={{ position: 'absolute', right: '12px', top: '34px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700 }}>%</span>
                                </div>
                                <button onClick={handleLogMeasurement} className="primary-btn active" style={{ height: '48px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', width: '100%' }}>{t('saveMeasurements')}</button>
                            </div>
                        </div>

                        <div>
                            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700, opacity: 0.9 }}>{t('recentHistory')}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {measurements.slice(0, 3).map((m, idx) => (
                                    <div key={idx} className="glass-panel" style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div>
                                            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{format(new Date(m.date), 'MMM dd, yyyy')}</p>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.weight} <small style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>kg</small></span>
                                                {m.waistCircumference > 0 && <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.waistCircumference} <small style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-secondary)' }}>cm</small></span>}
                                                {m.bodyFatPercentage > 0 && <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.bodyFatPercentage}%</span>}
                                            </div>
                                        </div>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: idx === 0 ? 'var(--success)' : 'rgba(255,255,255,0.1)' }}></div>
                                    </div>
                                ))}
                                {measurements.length === 0 && (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '16px', background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>No history yet.</p>
                                )}
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
    );
}
