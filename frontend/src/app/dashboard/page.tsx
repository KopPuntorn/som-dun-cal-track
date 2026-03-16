"use client";

import { useState, useEffect, useMemo } from 'react';
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

type RangeType = 'today' | 'week' | 'month' | 'all' | 'custom';

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

    const [water, setWater] = useState<number>(0);

    const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
    const [exerciseInput, setExerciseInput] = useState({ name: '', durationMinutes: 30, caloriesBurned: 0 });

    const [sleeps, setSleeps] = useState<SleepRecord[]>([]);
    const [sleepInput, setSleepInput] = useState({ durationHours: 8, durationMinutes: 0, quality: 'Good' });

    const [customStart, setCustomStart] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [aiLoading, setAiLoading] = useState(false);
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);

    const handleGetAiAdvice = async () => {
        if (!chartData.length) return;
        setAiLoading(true);
        setAiAdvice(null);
        setError(null);

        const activeDays = chartData.filter(d => d.calories > 0).length || 1;
        const totalCals = chartData.reduce((sum, d) => sum + d.calories, 0);
        const avgCals = Math.round(totalCals / activeDays);
        const totalPro = Math.round(chartData.reduce((sum, d) => sum + d.protein, 0) * 10) / 10;
        const avgPro = Math.round(totalPro / activeDays * 10) / 10;
        
        let measureCtx = "";
        if (measurements.length > 0) {
            const latest = measurements[measurements.length - 1];
            measureCtx = ` น้ำหนักล่าสุด ${latest.weight}kg, เอว ${latest.waistCircumference}cm, ไขมัน ${latest.bodyFatPercentage}%.`;
        }

        const summary = `ข้อมูลย้อนหลัง (${range}): มีข้อมูล ${activeDays}/${chartData.length} วัน. กินเฉลี่ย (เฉพาะวันที่บันทึก) คือ ${avgCals} kcal, โปรตีนเฉลี่ย ${avgPro}g. เป้าหมายแคลอรี่: ${goals.calories} kcal.${measureCtx} ช่วยวิเคราะห์และให้คำแนะนำหน่อยครับ`;

        try {
            const res = await fetch(`${API_BASE}/consult`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ summary, language }),
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
                const updatedRes = await fetch(`${API_BASE}/weight`);
                if (updatedRes.ok) {
                    const ws = await updatedRes.json();
                    setWeights(ws || []);
                }
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
                
                const updatedRes = await fetch(`${API_BASE}/measurements`);
                if (updatedRes.ok) {
                    const ms = await updatedRes.json();
                    setMeasurements(ms || []);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateWater = async (amount: number) => {
        const newTotal = Math.max(0, water + amount);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');
            const res = await fetch(`${API_BASE}/water`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: today, glasses: newTotal })
            });
            if (res.ok) setWater(newTotal);
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
        if (authLoading) return;

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
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
                    case 'all': start = null; break;
                }

                let summaryUrl = `${API_BASE}/dashboard/summary`;
                if (start) {
                    summaryUrl += `?start=${start.toISOString()}&end=${end.toISOString()}`;
                }

                const response = await fetch(summaryUrl);
                if (!response.ok) throw new Error(`Failed to fetch dashboard summary`);

                const data = await response.json();
                if (data.goals) setGoals({ calories: data.goals.calories || 2000, protein: data.goals.protein || 150, fat: data.goals.fat || 70 });
                if (data.user) setUser(data.user);
                setFoods(data.todayFoods || []);
                setWeights(data.weightRecent || []);
                setMeasurements(data.measurementsRecent || []);
                setWater(data.waterToday?.glasses || 0);
                setExercises(data.exerciseRecent || []);
                setSleeps(data.sleepRecent || []);
            } catch (err) {
                console.error("Failed to fetch data", err);
                setError("Failed to reach the server.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [range, authLoading]);

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
                    {(['today', 'week', 'month', 'all', 'custom'] as RangeType[]).map(r => (
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
                <div className="glass-panel" style={{ height: '380px', gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '24px' }}>Calorie Intake vs Goal</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <ReferenceLine y={goals.calories} stroke="var(--danger)" strokeDasharray="4 4" />
                            <Bar dataKey="calories" fill="url(#cal-gradient)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ height: '360px' }}>
                    <h3 style={{ marginBottom: '24px' }}>Protein Trends</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <Line type="monotone" dataKey="protein" stroke="url(#pro-gradient)" strokeWidth={3} dot={{ fill: 'var(--bg-color)', r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ height: '360px' }}>
                    <h3 style={{ marginBottom: '24px' }}>Fat Trends</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <Line type="monotone" dataKey="fat" stroke="url(#fat-gradient)" strokeWidth={3} dot={{ fill: 'var(--bg-color)', r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ height: '380px', gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '24px' }}>Body Measurements Trend</h3>
                    <ResponsiveContainer width="100%" height="80%">
                        <LineChart data={chartDataMeasurements}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip wrapperClassName="chart-tooltip" />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="waist" name="Waist (cm)" stroke="#bf5af2" strokeWidth={3} />
                            <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="Body Fat (%)" stroke="#32d74b" strokeWidth={3} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ padding: '32px' }}>
                    <h3 style={{ marginBottom: '24px', fontSize: '17px', fontWeight: 700 }}>Log Measurements</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <input type="number" placeholder="Weight" value={measurementInput.weight} onChange={e => setMeasurementInput({ ...measurementInput, weight: e.target.value })} />
                                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>KG</span>
                            </div>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <input type="number" placeholder="Waist" value={measurementInput.waist} onChange={e => setMeasurementInput({ ...measurementInput, waist: e.target.value })} />
                                <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>CM</span>
                            </div>
                        </div>
                        <button onClick={handleLogMeasurement} className="primary-btn active">SAVE CHANGES</button>
                    </div>
                </div>

                <div className="glass-panel" style={{ height: '360px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="icon-btn" style={{ background: 'var(--accent-pro-gradient)', border: 'none', width: '32px', height: '32px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                        </div>
                        Water Intake
                    </h3>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '56px', fontWeight: '800', background: 'var(--accent-pro-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>{water}</div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '8px' }}>Glasses Today</div>
                        <div style={{ display: 'flex', gap: '20px', marginTop: '32px' }}>
                            <button onClick={() => handleUpdateWater(-1)} className="glass-btn" style={{ width: '52px', height: '52px', borderRadius: '16px', fontSize: '24px' }}>-</button>
                            <button onClick={() => handleUpdateWater(1)} className="glass-btn active" style={{ width: '52px', height: '52px', borderRadius: '16px', fontSize: '24px' }}>+</button>
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
