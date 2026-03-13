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
import { format, subDays, startOfDay, endOfDay, isBefore, isAfter, eachDayOfInterval } from 'date-fns';
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

    // Custom Date States
    const [customStart, setCustomStart] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    const [aiLoading, setAiLoading] = useState(false);
    const [aiAdvice, setAiAdvice] = useState<string | null>(null);

    const handleGetAiAdvice = async () => {
        if (!chartData.length) return;
        setAiLoading(true);
        setAiAdvice(null);
        setError(null);

        // Calculate averages based only on days with data to be more meaningful
        const activeDays = chartData.filter(d => d.calories > 0).length || 1;
        const totalCals = chartData.reduce((sum, d) => sum + d.calories, 0);
        const avgCals = Math.round(totalCals / activeDays);
        const totalPro = Math.round(chartData.reduce((sum, d) => sum + d.protein, 0) * 10) / 10;
        const avgPro = Math.round(totalPro / activeDays * 10) / 10;
        
        // Add Body Measurement context if available
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
                // Refresh weights for the current range
                setWeightInput('');
                // re-trigger fetch somehow, or just append optimally 
                // A quick fetch all is fine for prototype
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
            // Attribute sleep to yesterday (the night that just passed)
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
                // We don't necessarily update a "sleepToday" state here like on Home page
                // as the charts will re-aggregate on next fetch or we could manually append.
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
        if (authLoading) return; // Wait for AuthContext to setup fetch interceptor

        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                let url = `${API_BASE}/foods`;

                // Calculate date ranges
                const now = new Date();
                let start: Date | null = null;
                let end: Date = endOfDay(now);

                switch (range) {
                    case 'today':
                        start = startOfDay(now);
                        break;
                    case 'week':
                        start = startOfDay(subDays(now, 6)); // Last 7 days including today
                        break;
                    case 'month':
                        start = startOfDay(subDays(now, 29)); // Last 30 days
                        break;
                    case 'custom':
                        if (customStart && customEnd) {
                            start = startOfDay(new Date(customStart));
                            end = endOfDay(new Date(customEnd));
                        } else {
                            start = startOfDay(now); // Fallback if dates not picked yet
                        }
                        break;
                    case 'all':
                        start = null; // Fetch everything
                        break;
                }

                let summaryUrl = `${API_BASE}/dashboard/summary`;
                if (start) {
                    summaryUrl += `?start=${start.toISOString()}&end=${end.toISOString()}`;
                }

                const response = await fetch(summaryUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch dashboard summary: ${response.status}`);
                }

                const data = await response.json();

                // Update all states from the consolidated data
                if (data.goals) {
                    setGoals({
                        calories: data.goals.calories || 2000,
                        protein: data.goals.protein || 150,
                        fat: data.goals.fat || 70
                    });
                }

                if (data.user) {
                    setUser(data.user);
                }

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

    // Aggregate data by day for charts
    const chartData = useMemo(() => {
        if (!foods.length) return [];

        // Create a map of date strings to grouped data
        const grouped = foods.reduce((acc, food) => {
            // Format date to local YYYY-MM-DD
            const dateObj = new Date(food.date);
            const dateStr = format(dateObj, 'MMM dd');
            const sortKey = format(dateObj, 'yyyy-MM-dd');

            if (!acc[sortKey]) {
                acc[sortKey] = { date: dateStr, sortKey: sortKey, calories: 0, protein: 0, fat: 0 };
            }
            acc[sortKey].calories += food.calories;
            acc[sortKey].protein += food.protein;
            acc[sortKey].fat += (food.fat || 0);
            return acc;
        }, {} as Record<string, { date: string, sortKey: string, calories: number, protein: number, fat: number }>);

        // If viewing a specific range (week/month/custom), fill in missing days with 0
        if (range === 'week' || range === 'month' || (range === 'custom' && customStart && customEnd)) {
            let start: Date, end: Date;

            if (range === 'week') {
                start = startOfDay(subDays(new Date(), 6));
                end = startOfDay(new Date());
            } else if (range === 'month') {
                start = startOfDay(subDays(new Date(), 29));
                end = startOfDay(new Date());
            } else {
                start = startOfDay(new Date(customStart));
                end = startOfDay(new Date(customEnd));
            }

            if (isBefore(start, end) || start.getTime() === end.getTime()) {
                const allDays = eachDayOfInterval({ start, end });
                const completeData = allDays.map(d => {
                    const sortKey = format(d, 'yyyy-MM-dd');
                    const dateStr = format(d, 'MMM dd');
                    return grouped[sortKey] || { date: dateStr, sortKey: sortKey, calories: 0, protein: 0, fat: 0 };
                });
                return completeData;
            }
        }

        // Return the grouped values sorted chronologically
        return Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [foods, range, customStart, customEnd]);

    const chartDataWeights = useMemo(() => {
        if (!weights.length) return [];
        return weights.map(w => ({
            date: format(new Date(w.date), 'MMM dd'),
            sortKey: format(new Date(w.date), 'yyyy-MM-dd'),
            weight: w.weight
        })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [weights]);

    const chartDataMeasurements = useMemo(() => {
        if (!measurements.length) return [];
        return measurements.map(m => ({
            date: format(new Date(m.date), 'MMM dd'),
            sortKey: format(new Date(m.date), 'yyyy-MM-dd'),
            weight: m.weight,
            waist: m.waistCircumference,
            bodyFat: m.bodyFatPercentage,
            photoUrl: m.progressPhotoUrl
        })).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    }, [measurements]);

    return (
        <div className="app-container">
            <header className="main-header glass-panel" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-start' }}>
                <Link href="/" className="icon-btn" style={{ textDecoration: 'none' }} title={t('back')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </Link>
                <div>
                    <h1 style={{ marginBottom: 0 }}>{user?.name ? `${user.name}'s ${t('navDashboard')}` : t('analyticsTitle')}</h1>
                    <p className="date-display">{t('historyTrends')}</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                        onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
                        className="icon-btn"
                        style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '40px' }}
                        title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
                    >
                        {language === 'en' ? 'TH' : 'EN'}
                    </button>
                    <Link href="/player-card" className="icon-btn" title="Player Card">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </Link>
                    <Link href="/profile" className="icon-btn mobile-hidden" title={t('profileSettings')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </Link>
                    <button onClick={logout} className="icon-btn mobile-hidden" title={t('logout')} style={{ color: "var(--danger)" }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
            </header>

            {/* Controls */}
            <section className="glass-panel" style={{ padding: '16px 24px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
                    <button
                        className={`primary-btn ${range === 'today' ? '' : 'outline'}`}
                        onClick={() => setRange('today')}
                        style={{ padding: '8px 16px', fontSize: '14px', background: range === 'today' ? 'var(--text-primary)' : 'transparent', color: range === 'today' ? '#000' : 'var(--text-primary)', border: range !== 'today' ? '1px solid var(--panel-border)' : 'none' }}
                    >Today</button>
                    <button
                        className={`primary-btn ${range === 'week' ? '' : 'outline'}`}
                        onClick={() => setRange('week')}
                        style={{ padding: '8px 16px', fontSize: '14px', background: range === 'week' ? 'var(--text-primary)' : 'transparent', color: range === 'week' ? '#000' : 'var(--text-primary)', border: range !== 'week' ? '1px solid var(--panel-border)' : 'none' }}
                    >Past 7 Days</button>
                    <button
                        className={`primary-btn ${range === 'month' ? '' : 'outline'}`}
                        onClick={() => setRange('month')}
                        style={{ padding: '8px 16px', fontSize: '14px', background: range === 'month' ? 'var(--text-primary)' : 'transparent', color: range === 'month' ? '#000' : 'var(--text-primary)', border: range !== 'month' ? '1px solid var(--panel-border)' : 'none' }}
                    >Past 30 Days</button>
                    <button
                        className={`primary-btn ${range === 'all' ? '' : 'outline'}`}
                        onClick={() => setRange('all')}
                        style={{ padding: '8px 16px', fontSize: '14px', background: range === 'all' ? 'var(--text-primary)' : 'transparent', color: range === 'all' ? '#000' : 'var(--text-primary)', border: range !== 'all' ? '1px solid var(--panel-border)' : 'none' }}
                    >All Time</button>
                    <button
                        className={`primary-btn ${range === 'custom' ? '' : 'outline'}`}
                        onClick={() => setRange('custom')}
                        style={{ padding: '8px 16px', fontSize: '14px', background: range === 'custom' ? 'var(--text-primary)' : 'transparent', color: range === 'custom' ? '#000' : 'var(--text-primary)', border: range !== 'custom' ? '1px solid var(--panel-border)' : 'none' }}
                    >Custom Range</button>
                </div>

                {/* Custom Date Pickers */}
                {range === 'custom' && (
                    <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Start Date</label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '14px', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>End Date</label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                min={customStart}
                                style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '14px', color: 'var(--text-primary)' }}
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* AI Advisor Card */}
            <section className="glass-panel" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: aiAdvice ? '12px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="icon-btn" style={{ background: 'var(--accent-cal-gradient)', border: 'none', width: '36px', height: '36px' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 12L2.7 16.5"></path></svg>
                        </div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>{t('aiAnalyst')}</h3>
                    </div>
                    <button
                        onClick={handleGetAiAdvice}
                        className="primary-btn"
                        disabled={aiLoading || loading}
                        style={{ margin: 0, padding: '8px 16px', fontSize: '13px' }}
                    >
                        {aiLoading ? t('analyzing') : t('getInsights')}
                    </button>
                </div>
                {aiAdvice && (
                    <div className="markdown-content" style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', borderLeft: '3px solid var(--accent-cal)' }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {aiAdvice!}
                        </ReactMarkdown>
                    </div>
                )}
            </section>

            {error && (
                <div style={{ background: "var(--danger)", padding: "12px", borderRadius: "12px", fontSize: "14px", color: "white" }}>
                    {error}
                </div>
            )}

            {/* Charts */}
            {loading ? (
                <div className="glass-panel" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    Loading Analytics...
                </div>
            ) : chartData.length === 0 ? (
                <div className="glass-panel" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    No data available for the selected period.
                </div>
            ) : (
                <div className="responsive-layout">

                    {/* Calories Chart */}
                    <div className="glass-panel" style={{ height: '350px', padding: '24px 24px 8px 24px', gridColumn: '1 / -1' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-cal)' }}></span>
                            Calorie Intake vs Goal
                        </h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(22, 27, 34, 0.9)', border: '1px solid var(--panel-border)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                />
                                <ReferenceLine y={goals.calories} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'top', value: 'Goal', fill: 'var(--danger)', fontSize: 12 }} />
                                <Bar dataKey="calories" name="Consumed (kcal)" fill="var(--accent-cal)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Weight Tracking Removed */}

                    {/* Protein Chart */}
                    <div className="glass-panel" style={{ height: '350px', padding: '24px 24px 8px 24px' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-pro)' }}></span>
                            Protein Trends
                        </h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(22, 27, 34, 0.9)', border: '1px solid var(--panel-border)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                />
                                <ReferenceLine y={goals.protein} stroke="var(--accent-pro)" strokeDasharray="3 3" label={{ position: 'top', value: 'Goal', fill: 'var(--accent-pro)', fontSize: 12 }} />
                                <Line type="monotone" dataKey="protein" name="Protein (g)" stroke="var(--accent-pro)" strokeWidth={3} dot={{ fill: 'var(--bg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Fat Chart */}
                    <div className="glass-panel" style={{ height: '350px', padding: '24px 24px 8px 24px' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-fat)' }}></span>
                            Fat Trends
                        </h3>
                        <ResponsiveContainer width="100%" height="85%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: 'rgba(22, 27, 34, 0.9)', border: '1px solid var(--panel-border)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                />
                                <ReferenceLine y={goals.fat} stroke="var(--accent-fat)" strokeDasharray="3 3" label={{ position: 'top', value: 'Goal', fill: 'var(--accent-fat)', fontSize: 12 }} />
                                <Line type="monotone" dataKey="fat" name="Fat (g)" stroke="var(--accent-fat)" strokeWidth={3} dot={{ fill: 'var(--bg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Body Measurement Chart */}
                    {chartDataMeasurements.length > 0 && (
                        <div className="glass-panel" style={{ height: '350px', padding: '24px 24px 8px 24px', gridColumn: '1 / -1' }}>
                            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#bf5af2' }}></span>
                                Body Measurements Trend (Waist & Body Fat)
                            </h3>
                            <ResponsiveContainer width="100%" height="85%">
                                <LineChart data={chartDataMeasurements} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis yAxisId="left" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgba(22, 27, 34, 0.9)', border: '1px solid var(--panel-border)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                        itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" dataKey="waist" name="Waist (cm)" stroke="#bf5af2" strokeWidth={3} dot={{ fill: 'var(--bg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
                                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="Body Fat (%)" stroke="#32d74b" strokeWidth={3} dot={{ fill: 'var(--bg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Weight Trend */}
                    {chartDataMeasurements.length > 0 && (
                        <div className="glass-panel" style={{ height: '350px', padding: '24px 24px 8px 24px' }}>
                            <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#ff375f' }}></span>
                                Weight Trend
                            </h3>
                            <ResponsiveContainer width="100%" height="85%">
                                <LineChart data={chartDataMeasurements} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ background: 'rgba(22, 27, 34, 0.9)', border: '1px solid var(--panel-border)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                        itemStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                                    />
                                    <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#ff375f" strokeWidth={3} dot={{ fill: 'var(--bg-color)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--text-primary)' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Body Measurement Logging Panel */}
                    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Log Body Measurements</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="number"
                                    placeholder="Weight (kg)"
                                    value={measurementInput.weight}
                                    onChange={e => setMeasurementInput({...measurementInput, weight: e.target.value})}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }}
                                />
                                <input
                                    type="number"
                                    placeholder="Waist (cm)"
                                    value={measurementInput.waist}
                                    onChange={e => setMeasurementInput({...measurementInput, waist: e.target.value})}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }}
                                />
                            </div>
                            <input
                                type="number"
                                placeholder="Body Fat (%)"
                                value={measurementInput.bodyFat}
                                onChange={e => setMeasurementInput({...measurementInput, bodyFat: e.target.value})}
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '14px' }}
                            />

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label className="primary-btn outline" style={{ cursor: 'pointer', padding: '8px 16px', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    {uploadingPhoto ? 'Uploading...' : 'Add Progress Photo'}
                                    <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} disabled={uploadingPhoto} />
                                </label>
                                {photoUrl && <span style={{ fontSize: '12px', color: 'var(--success)' }}>Photo attached ✓</span>}
                            </div>

                            <button onClick={handleLogMeasurement} className="primary-btn" style={{ marginTop: '8px' }}>
                                Save Measurements
                            </button>
                        </div>
                    </div>

                    {/* Water Tracking */}
                    <div className="glass-panel" style={{ height: '350px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: '#0ea5e9' }}></span>
                            Water Intake (Today)
                        </h3>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#0ea5e9', marginBottom: '8px' }}>
                                {water} <span style={{ fontSize: '20px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>glasses</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                                ~ {water * 250} ml
                            </p>
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <button onClick={() => handleUpdateWater(-1)} className="primary-btn outline" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '20px' }}>-</button>
                                <button onClick={() => handleUpdateWater(1)} className="primary-btn" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%', fontSize: '20px', background: '#0ea5e9', border: 'none' }}>+</button>
                            </div>
                        </div>
                    </div>

                    {/* Exercise Tracking Removed */}

                </div>
            )}

            <section style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '32px' }}>
                <button onClick={handleExport} className="primary-btn outline" style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export Data (CSV)
                </button>
            </section>
        </div>
    );
}
