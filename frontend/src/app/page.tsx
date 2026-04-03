"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import { startOfDay, endOfDay, format, subDays } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useZxing } from "react-zxing";
import { useAuth } from "@/context/AuthContext";
import type { UserProfile } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLanguage } from "@/context/LanguageContext";
import ConfirmModal from "@/components/ConfirmModal";
import ErrorState from "@/components/ErrorState";
import SuccessAnimation from "@/components/SuccessAnimation";
import CalendarPicker from "@/components/CalendarPicker";
import LoadingSkeleton, { SkeletonFoodCard } from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ParticleBurst from "@/components/ParticleBurst";
import TourOverlay from "@/components/TourOverlay";
import HydrationCard from "@/components/home/HydrationCard";
import QuickActionsRow from "@/components/home/QuickActionsRow";
import QuickAddSection from "@/components/home/QuickAddSection";
import TodayFeedSection from "@/components/home/TodayFeedSection";
import HomeHeader from "@/components/home/HomeHeader";
import PerformanceRingsCard from "@/components/home/PerformanceRingsCard";
import GoalsDashboard from "@/components/home/GoalsDashboard";
import { haptic } from "@/lib/haptics";
import { motion } from "framer-motion";

// Types
type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
  mealCategory?: string;
  date: string;
};

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
};

type QuickAddFood = {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  sodium?: number;
  fiber?: number;
};

type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
};

type ExerciseRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;
};

type SleepRecord = {
  id: string;
  durationHours: number;
  quality: string;
  date: string;
};

type WeightRecord = {
  id: string;
  weight: number;
  date: string;
};

type UnifiedActivity = {
  id: string;
  type: 'food' | 'exercise' | 'sleep' | 'weight';
  name: string;
  date: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  duration?: number;
  weight?: number;
  category?: string;
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

export default function Home() {
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const { showToast, showUndoToast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [foods, setFoods] = useState<Food[]>([]);
  const [goals, setGoals] = useState<Goals>({ calories: 2000, protein: 150, carbs: 250, fat: 70, sugar: 50, sodium: 2000, fiber: 30 });

  const [foodInputs, setFoodInputs] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast", date: format(new Date(), 'yyyy-MM-dd') });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStage, setAiStage] = useState<'idle' | 'compressing' | 'analyzing' | 'done'>('idle');
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [exerciseInput, setExerciseInput] = useState({ name: '', durationMinutes: 30, caloriesBurned: 0, date: format(new Date(), 'yyyy-MM-dd') });
  const [sleepInput, setSleepInput] = useState({ durationHours: 8, durationMinutes: 0, quality: 'Good', date: format(new Date(), 'yyyy-MM-dd') });
  const [exerciseToday, setExerciseToday] = useState(0);
  const [sleepToday, setSleepToday] = useState(0);

  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([]);
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [unifiedHistory, setUnifiedHistory] = useState<UnifiedActivity[]>([]);

  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [editingExercise, setEditingExercise] = useState<ExerciseRecord | null>(null);
  const [editingSleep, setEditingSleep] = useState<SleepRecord | null>(null);
  const [editInputs, setEditInputs] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast" });
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [logModalTab, setLogModalTab] = useState<'food' | 'exercise' | 'sleep' | 'measurements'>('food');
  const [detailView, setDetailView] = useState<'training' | 'recovery' | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [successVariant, setSuccessVariant] = useState<"food" | "exercise" | "sleep" | "water" | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const [burstPos, setBurstPos] = useState({ x: '50%', y: '50%' });
  const [burstColors, setBurstColors] = useState<string[]>(['#0ea5e9', '#f43f5e', '#a855f7', '#ffffff']);
  const [openCalendar, setOpenCalendar] = useState<"food" | "exercise" | "sleep" | null>(null);
  const [scanHint, setScanHint] = useState("");
  const [measurementInput, setMeasurementInput] = useState({ weight: '', waist: '', bodyFat: '' });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');

  // SWR for Dashboard Summary
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading } = useSWR(
    authLoading ? null : `${API_BASE}/dashboard/summary?lang=${language}`,
    fetcher,
    { revalidateOnFocus: true }
  );



  const dataFetchedRef = useRef(false);

  // Helper for image compression
  const compressImage = (file: File, maxWidth = 1024, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          reject(new Error('Invalid image data'));
          return;
        }
        const img = document.createElement('img') as HTMLImageElement;
        img.src = result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas toBlob failed'));
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => reject(new Error('Image load failed'));
      };
      reader.onerror = () => reject(new Error('File read failed'));
    });
  };

  const getCompositeDate = (dateStr: string) => {
    const now = new Date();
    if (!dateStr || dateStr === format(now, 'yyyy-MM-dd')) return now.toISOString();

    // For other dates, use the selected date but with current local time
    // to avoid defaulting to 00:00 UTC (which is 07:00 local in Thailand)
    const [y, m, d] = dateStr.split('-').map(Number);
    const composite = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
    return composite.toISOString();
  };

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<{
    name: string; brand: string; kcalPer100g: number;
    proteinPer100g: number; carbsPer100g: number; fatPer100g: number;
    servingSize: number; imageUrl?: string;
  } | null>(null);
  const [barcodeServing, setBarcodeServing] = useState(100);
  const { ref: zxingRef } = useZxing({
    constraints: { video: { facingMode: 'environment' } },
    onDecodeResult(result) {
      if (!isScanning) return;

      const text = result.getText();
      setIsScanning(false);
      setAiLoading(true);
      setError(null);

      // Fetch via backend proxy
      fetch(`${API_BASE}/product/${text}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('auth_token')}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 1 && data.product) {
            const p = data.product;
            const nutris = p.nutriments || {};
            const servingG = nutris['serving_size'] ? parseFloat(nutris['serving_size']) : 100;
            const preview = {
              name: p.product_name || `Barcode ${text.substring(0, 8)}`,
              brand: p.brands || '',
              kcalPer100g: Math.round(nutris['energy-kcal_100g'] || 0),
              proteinPer100g: Math.round((nutris['proteins_100g'] || 0) * 10) / 10,
              carbsPer100g: Math.round((nutris['carbohydrates_100g'] || 0) * 10) / 10,
              fatPer100g: Math.round((nutris['fat_100g'] || 0) * 10) / 10,
              servingSize: isNaN(servingG) || servingG <= 0 ? 100 : Math.round(servingG),
              imageUrl: p.image_small_url || p.image_url || undefined,
            };
            setBarcodePreview(preview);
            setBarcodeServing(preview.servingSize);
          } else {
            showToast(language === 'en' ? 'Product not found in database' : 'ไม่พบสินค้าในฐานข้อมูล', "error");
            setError(language === 'en' ? `Barcode not found: ${text}` : `ไม่พบบาร์โค้ด: ${text}`);
          }
        })
        .catch(err => {
          console.error("Scanner Error:", err);
          showToast(language === 'en' ? 'Failed to fetch product data' : 'ดึงข้อมูลสินค้าไม่สำเร็จ', "error");
        })
        .finally(() => {
          setAiLoading(false);
        });
    },
    paused: !isScanning,
  });

  const currentDate = new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  // Sync SWR data to state for UI consistency (or use data directly in render)
  useEffect(() => {
    if (dashboardData) {
      if (dashboardData.goals) {
        setGoals({
          calories: dashboardData.goals.calories || 2000,
          protein: dashboardData.goals.protein || 150,
          carbs: dashboardData.goals.carbs || 250,
          fat: dashboardData.goals.fat || 70,
          sugar: dashboardData.goals.sugar || 50,
          sodium: dashboardData.goals.sodium || 2000,
          fiber: dashboardData.goals.fiber || 30
        });
      }
      if (dashboardData.user) {
        if (dashboardData.user.onboarded && !dashboardData.user.tourCompleted) {
          // Tour disabled for now - uncomment below to re-enable
          // setShowTour(true);
        }
      }
      setFoods(dashboardData.todayFoods || []);
      setWaterGlasses(dashboardData.waterToday?.glasses || 0);
      setRecentFoods(dashboardData.recentFoods || []);
      setWeightRecords(dashboardData.weightRecent || []);

      const today = format(new Date(), 'yyyy-MM-dd');
      const exerciseRecent = dashboardData.exerciseRecent || [];
      const exToday = exerciseRecent
        .filter((e: ExerciseRecord) => format(new Date(e.date), 'yyyy-MM-dd') === today)
        .reduce((sum: number, e: ExerciseRecord) => sum + e.durationMinutes, 0);
      setExerciseToday(exToday);
      setExerciseRecords(exerciseRecent);

      const sleepRecent = dashboardData.sleepRecent || [];
      let slToday = 0;
      const latestSleep = sleepRecent[0];
      if (latestSleep) {
        const latestDate = new Date(latestSleep.date);
        const hoursSinceLatest = (new Date().getTime() - latestDate.getTime()) / (1000 * 60 * 60);
        if (format(latestDate, 'yyyy-MM-dd') === today || hoursSinceLatest < 24) {
          slToday = latestSleep.durationHours;
        }
      }
      setSleepToday(slToday);
      setSleepRecords(sleepRecent);

      if (dashboardData.unifiedHistory) {
        setUnifiedHistory(dashboardData.unifiedHistory);
      } else {
        // Fallback for transition
        setUnifiedHistory([]);
      }

      setLoading(false);
    }
    if (dashboardError) {
      setError("Failed to reach the server. Make sure the Go backend is running and MongoDB is connected.");
      setLoading(false);
    }
  }, [dashboardData, dashboardError]);

  useEffect(() => {
    setMounted(true);
  }, []);



  // Handle URL params and events
  useEffect(() => {
    if (authLoading) return;

    if (window.location.search.includes('add=true')) {
      setLogModalTab('food');
      setIsActionModalOpen(true);
      window.history.replaceState({}, '', '/');
    }

    if (window.location.search.includes('log=true')) {
      setLogModalTab('exercise');
      setIsActionModalOpen(true);
      window.history.replaceState({}, '', '/');
    }

    const handleOpenModal = () => {
      setLogModalTab('food');
      setIsActionModalOpen(true);
    };
    const handleOpenActivityModal = () => {
      setLogModalTab('exercise');
      setIsActionModalOpen(true);
    };

    window.addEventListener('openAddFoodModal', handleOpenModal);
    window.addEventListener('openLogActivityModal', handleOpenActivityModal);

    return () => {
      window.removeEventListener('openAddFoodModal', handleOpenModal);
      window.removeEventListener('openLogActivityModal', handleOpenActivityModal);
    };
  }, [authLoading]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isActionModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isActionModalOpen]);

  const handleCompleteTour = async () => {
    setShowTour(false);
    try {
      await fetch(`${API_BASE}/user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourCompleted: true })
      });
    } catch (err) {
      console.error("Failed to update tour status", err);
    }
  };

  const tourSteps = [
    { title: t('tourWelcomeTitle'), desc: t('tourWelcomeDesc'), target: null, icon: "⚖️" },
    { title: t('tourFoodTitle'), desc: t('tourFoodDesc'), target: 'add-food-btn', icon: "🥗" },
    { title: t('tourActivityTitle'), desc: t('tourActivityDesc'), target: 'log-activity-btn', icon: "🏃" },
    { title: t('tourAiTitle'), desc: t('tourAiDesc'), target: 'chat-toggle-btn', icon: "🤖" },
    { title: t('tourAnalyticsTitle'), desc: t('tourAnalyticsDesc'), target: 'analytics-section', icon: "📊" },
    { title: t('tourPlayerCardTitle'), desc: t('tourPlayerCardDesc'), target: 'player-card-section', icon: "🏆" },
  ];

  useEffect(() => {
    if (showTour) {
      const updateRect = () => {
        const currentTarget = tourSteps[tourStep].target;
        if (!currentTarget) {
          setHighlightRect(null);
          return;
        }

        let targetId = currentTarget;
        // Switch to mobile targets if needed
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          if (targetId === 'add-food-btn') targetId = 'add-food-btn-mobile';
          if (targetId === 'profile-btn') targetId = 'profile-btn-mobile';
          if (targetId === 'log-activity-btn') targetId = 'log-activity-btn-mobile';
          if (targetId === 'chat-toggle-btn') targetId = 'chat-toggle-btn-mobile';
        }

        const el = document.getElementById(targetId);
        if (el) {
          const rect = el.getBoundingClientRect();
          setHighlightRect(rect);
        } else {
          setHighlightRect(null);
        }
      };

      // Initial measure with a slight delay to ensure layout is ready
      const timer = setTimeout(updateRect, 150);
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    } else {
      setHighlightRect(null);
    }
  }, [showTour, tourStep]);

  // Handlers
  const handleUpdateWater = async (increment: number) => {
    haptic(increment > 0 ? "success" : "light");
    const newGlasses = Math.max(0, waterGlasses + increment);
    setWaterGlasses(newGlasses);
    if (increment > 0) {
      showToast(`Added water! (${newGlasses} glasses)`, "success");
      setSuccessVariant("water");
      setBurstPos({ x: '85%', y: '45%' });
      setBurstColors(['#0ea5e9', '#38bdf8', '#bae6fd']);
      setBurstTrigger(prev => prev + 1);
      setTimeout(() => setSuccessVariant(null), 1600);
    }
    try {
      await fetch(`${API_BASE}/water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(new Date(), 'yyyy-MM-dd'),
          glasses: newGlasses
        })
      });
      mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
      refreshUser();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogExercise = async () => {
    if (!exerciseInput.name || exerciseInput.durationMinutes <= 0) {
      showToast("Please enter activity name and duration", "error");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/exercise`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...exerciseInput,
          date: getCompositeDate(exerciseInput.date)
        })
      });
      if (res.ok) {
        const record = await res.json();
        setExerciseRecords([record, ...exerciseRecords]);
        setExerciseToday(prev => prev + Number(exerciseInput.durationMinutes));
        setExerciseInput({ name: '', durationMinutes: 30, caloriesBurned: 0, date: format(new Date(), 'yyyy-MM-dd') });
        showToast("Activity logged!", "success");
        setSuccessVariant("exercise");
        setBurstPos({ x: '50%', y: '50%' });
        setBurstColors(['#f43f5e', '#fb7185', '#fda4af']);
        setBurstTrigger(prev => prev + 1);
        setTimeout(() => setSuccessVariant(null), 1600);
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to log activity", "error");
    }
  };

  const handleLogSleep = async () => {
    if (sleepInput.durationHours <= 0) {
      showToast("Please enter valid sleep hours", "error");
      return;
    }
    try {
      const totalHours = Number(sleepInput.durationHours) + (Number(sleepInput.durationMinutes) / 60);
      const res = await fetch(`${API_BASE}/sleep`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationHours: totalHours,
          quality: sleepInput.quality,
          date: getCompositeDate(sleepInput.date)
        })
      });
      if (res.ok) {
        const record = await res.json();
        setSleepRecords([record, ...sleepRecords]);
        setSleepToday(prev => prev + totalHours);
        setSleepInput({ durationHours: 8, durationMinutes: 0, quality: 'Good', date: format(new Date(), 'yyyy-MM-dd') });
        showToast("Sleep logged!", "success");
        setSuccessVariant("sleep");
        setBurstPos({ x: '50%', y: '50%' });
        setBurstColors(['#a855f7', '#c084fc', '#d8b4fe']);
        setBurstTrigger(prev => prev + 1);
        setTimeout(() => setSuccessVariant(null), 1600);
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to log activity", "error");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setPhotoUrl(data.url);
      } else {
        showToast("Failed to upload photo", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error uploading photo", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogMeasurement = async () => {
    const w = parseFloat(measurementInput.weight);
    if (isNaN(w) || w <= 0) {
      showToast("Please enter a valid weight", "error");
      return;
    }
    const waist = parseFloat(measurementInput.waist);
    const bf = parseFloat(measurementInput.bodyFat);
    try {
      const res = await fetch(`${API_BASE}/measurements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: w,
          waistCircumference: isNaN(waist) ? 0 : waist,
          bodyFatPercentage: isNaN(bf) ? 0 : bf,
          progressPhotoUrl: photoUrl,
          date: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setMeasurementInput({ weight: '', waist: '', bodyFat: '' });
        setPhotoUrl('');
        showToast("Measurement saved!", "success");
        setSuccessVariant("food");
        setBurstPos({ x: '50%', y: '50%' });
        setBurstColors(['#82a67d', '#5b8266', '#a855f7']);
        setBurstTrigger(prev => prev + 1);
        setTimeout(() => setSuccessVariant(null), 1600);
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
      showToast("Error saving measurement", "error");
    }
  };

  const confirmBarcodePreview = () => {
    if (!barcodePreview) return;
    const ratio = barcodeServing / 100;
    setFoodInputs(prev => ({
      ...prev,
      name: barcodePreview.name,
      calories: String(Math.round(barcodePreview.kcalPer100g * ratio)),
      protein: String(Math.round(barcodePreview.proteinPer100g * ratio * 10) / 10),
      carbs: String(Math.round(barcodePreview.carbsPer100g * ratio * 10) / 10),
      fat: String(Math.round(barcodePreview.fatPer100g * ratio * 10) / 10),
    }));
    setBarcodePreview(null);
  };

  const handleReLogFood = (food: Food) => {
    setFoodInputs({
      name: food.name,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs || ''),
      fat: String(food.fat || ''),
      sugar: String((food as any).sugar || ''),
      sodium: String((food as any).sodium || ''),
      fiber: String((food as any).fiber || ''),
      mealCategory: food.mealCategory || 'Breakfast',
      date: format(new Date(), 'yyyy-MM-dd'),
    });
    setAiConfidence(null);
    setAiStage('idle');
    setLogModalTab('food');
    setIsActionModalOpen(true);
  };

  const openEditModal = (food: Food) => {
    setEditingFood(food);
    setEditInputs({
      name: food.name,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs || 0),
      fat: String(food.fat || 0),
      sugar: String(food.sugar || 0),
      sodium: String(food.sodium || 0),
      fiber: String(food.fiber || 0),
      mealCategory: food.mealCategory || "Breakfast"
    });
  };

  const handleEditFoodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFood) return;

    try {
      const res = await fetch(`${API_BASE}/foods/${editingFood.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editInputs.name,
          calories: Number(editInputs.calories),
          protein: Number(editInputs.protein),
          carbs: Number(editInputs.carbs),
          fat: Number(editInputs.fat),
          sugar: Number(editInputs.sugar),
          sodium: Number(editInputs.sodium),
          fiber: Number(editInputs.fiber),
          mealCategory: editInputs.mealCategory,
          date: editingFood.date
        })
      });

      if (res.ok) {
        const updatedFood = await res.json();
        setFoods(foods.map(f => f.id === updatedFood.id ? updatedFood : f));
        setRecentFoods(prev => prev.map(f => f.name === editingFood.name ? { ...f, name: updatedFood.name, calories: updatedFood.calories, protein: updatedFood.protein } : f));
        setEditingFood(null);
        showToast("Entry updated!", "success");
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/foods/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300);
  };

  const selectSearchResult = (item: Food) => {
    setFoodInputs({
      name: item.name,
      calories: String(item.calories),
      protein: String(item.protein),
      carbs: String(item.carbs || 0),
      fat: String(item.fat || 0),
      sugar: String(item.sugar || 0),
      sodium: String(item.sodium || 0),
      fiber: String(item.fiber || 0),
      mealCategory: foodInputs.mealCategory,
      date: foodInputs.date
    });
    setSearchResults([]);
  };

  const handleAddFood = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, calories, protein, carbs, fat, sugar, sodium, fiber } = foodInputs;
    const cal = parseFloat(calories);
    const pro = parseFloat(protein);
    const crb = parseFloat(carbs) || 0;
    const ft = parseFloat(fat) || 0;
    const sgr = parseFloat(sugar) || 0;
    const sdm = parseFloat(sodium) || 0;
    const fbr = parseFloat(fiber) || 0;

    if (!name || isNaN(cal) || isNaN(pro)) return;

    // Optimistic: add a temporary entry immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticFood: Food = {
      id: tempId,
      name,
      calories: cal,
      protein: pro,
      carbs: crb,
      fat: ft,
      sugar: sgr,
      sodium: sdm,
      fiber: fbr,
      mealCategory: foodInputs.mealCategory,
      date: getCompositeDate(foodInputs.date),
    };
    setFoods(prev => [optimisticFood, ...prev]);
    setFoodInputs({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast", date: format(new Date(), 'yyyy-MM-dd') });
    setAiConfidence(null);
    setAiStage('idle');

    try {
      const res = await fetch(`${API_BASE}/foods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          calories: cal,
          protein: pro,
          carbs: crb,
          fat: ft,
          sugar: sgr,
          sodium: sdm,
          fiber: fbr,
          mealCategory: optimisticFood.mealCategory,
          date: optimisticFood.date,
        })
      });

      if (res.ok) {
        const newFood = await res.json();
        // Replace the optimistic entry with the real one from server
        setFoods(prev => prev.map(f => f.id === tempId ? newFood : f));
        showToast(`Added ${name}!`, "success");
        setSuccessVariant("food");
        setBurstPos({ x: '50%', y: '85%' });
        setBurstColors(['#f43f5e', '#fb7185', '#fda4af']);
        setBurstTrigger(prev => prev + 1);
        setTimeout(() => setSuccessVariant(null), 1600);
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      } else {
        // Rollback on server error
        setFoods(prev => prev.filter(f => f.id !== tempId));
        showToast(language === 'en' ? 'Failed to save food' : 'บันทึกไม่สำเร็จ', "error");
      }
    } catch (err) {
      console.error(err);
      setFoods(prev => prev.filter(f => f.id !== tempId));
      showToast(language === 'en' ? 'Network error — food not saved' : 'เกิดข้อผิดพลาด — ไม่ได้บันทึก', "error");
    }
  };

  const handleDeleteFood = async (id: string) => {
    const deletedFood = foods.find(f => f.id === id);
    setFoods(foods.filter(f => f.id !== id));

    const timer = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/foods/${id}`, { method: "DELETE" });
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      } catch (err) { console.error(err); }
    }, 5000);

    showUndoToast(`${t('deleted')}: ${deletedFood?.name || ''}`, () => {
      clearTimeout(timer);
      if (deletedFood) setFoods(prev => [deletedFood, ...prev]);
      showToast(t('restored'), 'success');
    });
  };

  const handleDeleteExercise = async (id: string) => {
    const deletedRecord = exerciseRecords.find(r => r.id === id);
    if (deletedRecord) setExerciseToday(prev => Math.max(0, prev - deletedRecord.durationMinutes));
    setExerciseRecords(exerciseRecords.filter(r => r.id !== id));

    const timer = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/exercise/${id}`, { method: "DELETE" });
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      } catch (err) { console.error(err); }
    }, 5000);

    showUndoToast(t('deleted'), () => {
      clearTimeout(timer);
      if (deletedRecord) {
        setExerciseRecords(prev => [deletedRecord, ...prev]);
        setExerciseToday(prev => prev + deletedRecord.durationMinutes);
      }
      showToast(t('restored'), 'success');
    });
  };

  const handleDeleteSleep = async (id: string) => {
    const deletedRecord = sleepRecords.find(r => r.id === id);
    if (deletedRecord) setSleepToday(prev => Math.max(0, prev - deletedRecord.durationHours));
    setSleepRecords(sleepRecords.filter(r => r.id !== id));

    const timer = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/sleep/${id}`, { method: "DELETE" });
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      } catch (err) { console.error(err); }
    }, 5000);

    showUndoToast(t('deleted'), () => {
      clearTimeout(timer);
      if (deletedRecord) {
        setSleepRecords(prev => [deletedRecord, ...prev]);
        setSleepToday(prev => prev + deletedRecord.durationHours);
      }
      showToast(t('restored'), 'success');
    });
  };

  const handleDeleteWeight = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/weight/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWeightRecords(weightRecords.filter(r => r.id !== id));
        showToast("Weight record deleted", "info");
      }
    } catch (err) { console.error(err); }
  };


  const handleEditExerciseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExercise) return;
    try {
      const res = await fetch(`${API_BASE}/exercise/${editingExercise.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingExercise)
      });
      if (res.ok) {
        const updated = await res.json();
        setExerciseRecords(exerciseRecords.map(r => r.id === updated.id ? updated : r));
        setEditingExercise(null);
        showToast("Exercise updated!", "success");
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleEditSleepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSleep) return;
    try {
      const res = await fetch(`${API_BASE}/sleep/${editingSleep.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSleep)
      });
      if (res.ok) {
        const updated = await res.json();
        setSleepRecords(sleepRecords.map(r => r.id === updated.id ? updated : r));
        setEditingSleep(null);
        showToast("Sleep record updated!", "success");
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
      }
    } catch (err) { console.error(err); }
  };

  const handleQuickAdd = async (food: QuickAddFood) => {
    try {
      const res = await fetch(`${API_BASE}/foods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          sugar: food.sugar,
          sodium: food.sodium,
          fiber: food.fiber
        })
      });

      if (res.ok) {
        const newFood = await res.json();
        setFoods(prev => [newFood, ...prev]);
        showToast(`Quick added ${food.name}!`, "success");
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
      }
    } catch (err) {
      console.error(err);
    }
  };


  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiLoading(true);
    setAiStage('compressing');
    setAiConfidence(null);
    setError(null);

    const formData = new FormData();
    formData.append("language", language);
    if (scanHint.trim()) {
      formData.append("hint", scanHint.trim());
    }

    try {
      const compressedBlob = await compressImage(file);
      formData.append("image", compressedBlob, "image.jpg");
    } catch (err) {
      console.warn("Compression failed, uploading original:", err);
      formData.append("image", file);
    }

    setAiStage('analyzing');

    try {
      const res = await fetch(`${API_BASE}/analyze-image`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAiStage('done');
        setAiConfidence(data.confidence ?? null);
        setFoodInputs({
          name: data.name || "",
          calories: String(data.calories || ""),
          protein: String(data.protein || ""),
          carbs: String(data.carbs || ""),
          fat: String(data.fat || ""),
          sugar: String(data.sugar || ""),
          sodium: String(data.sodium || ""),
          fiber: String(data.fiber || ""),
          mealCategory: foodInputs.mealCategory,
          date: foodInputs.date,
        });
        setScanHint("");
      } else {
        const errData = await res.json().catch(() => ({}));
        setAiStage('idle');
        if (errData.code === 'LIMIT_REACHED') {
          setError(language === 'en' ? 'Daily AI scan limit reached. Upgrade to Pro for unlimited scans.' : 'ใช้ AI สแกนครบโควต้าประจำวันแล้ว อัพเกรดเป็น Pro เพื่อสแกนไม่จำกัด');
        } else {
          setError(errData.error || (language === 'en' ? 'Failed to analyze image' : 'วิเคราะห์รูปภาพไม่สำเร็จ'));
        }
      }
    } catch (err) {
      console.error(err);
      setAiStage('idle');
      setError(language === 'en' ? 'AI service unavailable. Please try again.' : 'AI ไม่พร้อมใช้งาน กรุณาลองใหม่');
    } finally {
      setAiLoading(false);
      if (e.target) e.target.value = "";
    }
  };



  // Calculations
  const totals = foods.reduce(
    (acc, food) => ({
      calories: acc.calories + food.calories,
      protein: acc.protein + food.protein,
      carbs: acc.carbs + (food.carbs || 0),
      fat: acc.fat + (food.fat || 0),
      sugar: acc.sugar + (food.sugar || 0),
      sodium: acc.sodium + (food.sodium || 0),
      fiber: acc.fiber + (food.fiber || 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, fiber: 0 }
  );

  const calTotal = Math.round(totals.calories);
  const proTotal = Math.round(totals.protein * 10) / 10;
  const carbTotal = Math.round(totals.carbs * 10) / 10;
  const fatTotal = Math.round(totals.fat * 10) / 10;

  // Active Burn Calculation
  const today = format(new Date(), 'yyyy-MM-dd');
  const burnedToday = Math.round(exerciseRecords
    .filter(e => format(new Date(e.date), 'yyyy-MM-dd') === today)
    .reduce((sum, e) => sum + (e.caloriesBurned || 0), 0)
  );

  const adjustedCalGoal = goals.calories + burnedToday;
  const calRemaining = Math.max(0, adjustedCalGoal - calTotal);
  const proRemaining = Math.max(0, Math.round((goals.protein - proTotal) * 10) / 10);
  const carbRemaining = Math.max(0, Math.round((goals.carbs - carbTotal) * 10) / 10);
  const fatRemaining = Math.max(0, Math.round((goals.fat - fatTotal) * 10) / 10);

  // Ring Calculation
  const radius = 70;
  const circumference = radius * 2 * Math.PI;
  const calPercent = Math.min(100, Math.max(0, (calTotal / adjustedCalGoal) * 100));
  const calOffset = circumference - (calPercent / 100) * circumference;
  const isOverCal = calTotal > adjustedCalGoal;
  const exercisePercent = Math.min(100, Math.max(0, (exerciseToday / 30) * 100));
  const sleepPercent = Math.min(100, Math.max(0, (sleepToday / 8) * 100));

  // Bar Calculations
  const proPercent = Math.min(100, Math.max(0, (proTotal / goals.protein) * 100));
  const carbPercent = Math.min(100, Math.max(0, (carbTotal / goals.carbs) * 100));
  const fatPercent = Math.min(100, Math.max(0, (fatTotal / goals.fat) * 100));
  const hydrationGoal = 8;
  const waterPercent = Math.min(100, Math.max(0, (waterGlasses / hydrationGoal) * 100));
  const waterRemaining = Math.max(0, hydrationGoal - waterGlasses);

  const isGoalFat = fatTotal >= goals.fat;

  // Gamification Logic (Synced with Backend)
  const totalXP = user?.xp || 0;
  const level = user?.level || 1;
  const currentLevelXP = totalXP % 1000;
  const xpProgress = (currentLevelXP / 1000) * 100;
  const stepLabel = t('tourStep');

  if (!mounted) return null;

  return (
    <div className="page-shell">
      <div className="floating-blob floating-blob-1" />
      <div className="floating-blob floating-blob-2" />
      <div className="floating-blob floating-blob-3" />
      <div className="app-container perspective-1000">
        {/* Search Header */}

        <TourOverlay
          show={showTour}
          steps={tourSteps}
          currentStep={tourStep}
          onNext={() => {
            if (tourStep < tourSteps.length - 1) {
              setTourStep(tourStep + 1);
            }
          }}
          onPrev={() => {
            if (tourStep > 0) {
              setTourStep(tourStep - 1);
            }
          }}
          onSkip={handleCompleteTour}
          onFinish={handleCompleteTour}
          highlightRect={highlightRect}
          stepLabel={stepLabel}
          nextLabel={t('tourNext')}
          backLabel={t('tourBack')}
          skipLabel={t('tourSkip')}
          finishLabel={t('tourFinish')}
        />
        {error && (
          <ErrorState
            title={
              error.includes('AI') || error.includes('analyze') || error.includes('วิเคราะห์')
                ? (language === 'en' ? 'AI Analysis Failed' : 'วิเคราะห์ไม่สำเร็จ')
                : error.includes('limit') || error.includes('โควต้า')
                ? (language === 'en' ? 'Daily Limit Reached' : 'ถึงขีดจำกัดประจำวัน')
                : (language === 'en' ? 'Something went wrong' : 'เกิดข้อผิดพลาด')
            }
            message={error}
            onRetry={() => { setError(null); mutate(`${API_BASE}/dashboard/summary?lang=${language}`); }}
            retryLabel={t('retry')}
            onSecondaryAction={
              (error.includes('AI') || error.includes('analyze') || error.includes('วิเคราะห์'))
                ? () => { setError(null); setLogModalTab('food'); setIsActionModalOpen(true); }
                : undefined
            }
            secondaryLabel={language === 'en' ? 'Enter Manually' : 'กรอกเอง'}
          />
        )}


        <HomeHeader
          currentDate={currentDate}
          level={level}
          streakDays={user?.streakDays || 0}
          currentLevelXP={currentLevelXP}
          xpProgress={xpProgress}
          languageLabel={language === 'en' ? 'TH' : 'EN'}
          languageToggleTitle={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
          quickAddTitle={t('quickAdd')}
          aiAssistantTitle={t('navAiAssistant')}
          analyticsTitle={t('analyticsTitle')}
          playerCardTitle={t('playerCard')}
          profileSettingsTitle={t('profileSettings')}
          onToggleLanguage={() => setLanguage(language === 'en' ? 'th' : 'en')}
          onQuickAdd={() => {
            haptic("medium");
            setLogModalTab('food');
            setIsActionModalOpen(true);
          }}
        />

        <div className="responsive-layout home-layout">
          <motion.div
            className="layout-column home-overview"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <PerformanceRingsCard
              title={t('performanceRings')}
              subtitle={currentDate}
              metrics={[
                {
                  label: t('nut'),
                  percent: Math.round(calPercent),
                  value: `${calTotal}/${adjustedCalGoal} kcal`,
                  tone: 'nutrition',
                },
                {
                  label: t('hyd'),
                  percent: Math.round(waterPercent),
                  value: `${waterGlasses}/${hydrationGoal} ${t('glasses')}`,
                  tone: 'hydration',
                },
                {
                  label: t('fit'),
                  percent: Math.round(exercisePercent),
                  value: `${exerciseToday}/30 ${t('unitMin')}`,
                  tone: 'fitness',
                },
                {
                  label: t('rec'),
                  percent: Math.round(sleepPercent),
                  value: `${Math.round(sleepToday * 10) / 10}/8 ${t('unitHr')}`,
                  tone: 'recovery',
                },
              ]}
            />

            <GoalsDashboard
              dailyTargetsLabel={t('dailyTargets')}
              dailyGoalsLabel={t('dailyGoals')}
              caloriesLabel={t('calories')}
              targetLabel={t('target')}
              activeBonusLabel={t('activeBonus')}
              remainingLabel={t('remaining')}
              overLabel={t('over')}
              onTargetLabel={t('onTarget')}
              caloriesTarget={goals.calories}
              adjustedCalGoal={adjustedCalGoal}
              calTotal={calTotal}
              calRemaining={calRemaining}
              burnedToday={burnedToday}
              isOverCal={isOverCal}
              loading={loading}
              macros={[
                {
                  tone: 'protein',
                  label: t('protein'),
                  consumed: proTotal,
                  goal: goals.protein,
                  percent: proPercent,
                  remaining: proRemaining,
                  isComplete: proTotal >= goals.protein,
                },
                {
                  tone: 'carbs',
                  label: t('carbs'),
                  consumed: carbTotal,
                  goal: goals.carbs,
                  percent: carbPercent,
                  remaining: carbRemaining,
                  isComplete: carbTotal >= goals.carbs,
                },
                {
                  tone: 'fat',
                  label: t('fat'),
                  consumed: fatTotal,
                  goal: goals.fat,
                  percent: fatPercent,
                  remaining: fatRemaining,
                  isComplete: isGoalFat,
                },
              ]}
            />

            {/* Unified Activity Feed */}
            <div className="dashboard-logs desktop-feed-only" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
              <section className="foods-list-section">
                <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>{t('todayFeed')}</h3>
                <div className="foods-list">
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[1, 2, 3].map(i => (
                        <SkeletonFoodCard key={i} />
                      ))}
                    </div>
                  ) : (unifiedHistory.length === 0) ? (
                    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', color: 'var(--text-secondary)', textAlign: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{t('noFoodLogged')}</div>
                      <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('tapFoodButton')}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {unifiedHistory.map((item) => {
                        let icon = '📝';
                        let color = 'var(--text-primary)';
                        let stats = null;
                        let canEdit = true;

                        if (item.type === 'food') {
                          const cat = (item.category || 'Breakfast').toLowerCase();
                          if (cat === 'breakfast') icon = '🍳';
                          else if (cat === 'lunch') icon = '🥗';
                          else if (cat === 'dinner') icon = '🍲';
                          else icon = '🍪';
                          color = 'var(--accent-cal)';
                          stats = (
                            <span>
                              <strong style={{ color }}>{item.calories}</strong> kcal
                              {item.protein ? <span> | <strong>{item.protein}</strong>g P</span> : null}
                              {item.carbs ? <span> | <strong>{item.carbs}</strong>g C</span> : null}
                              {item.fat ? <span> | <strong>{item.fat}</strong>g F</span> : null}
                            </span>
                          );
                        } else if (item.type === 'exercise') {
                          icon = '🏃';
                          color = 'var(--accent-pro)';
                          stats = (
                            <span>
                              <strong>{item.duration}</strong> min | <strong style={{ color }}>{item.calories}</strong> kcal
                            </span>
                          );
                        } else if (item.type === 'sleep') {
                          icon = '🌙';
                          color = 'var(--accent-fat)';
                          stats = (
                            <span>
                              <strong>{item.duration}</strong> hrs | {item.category === 'Good' ? t('goodQuality') : item.category === 'Fair' ? t('fairQuality') : t('poorQuality')}
                            </span>
                          );
                        } else if (item.type === 'weight') {
                          icon = '⚖️';
                          color = '#38bdf8';
                          stats = (
                            <span>
                              <strong style={{ color }}>{item.weight}</strong> kg
                            </span>
                          );
                          canEdit = false;
                        }

                        return (
                          <div key={`${item.type}-${item.id}`} className="food-item" style={{ padding: '12px 20px', borderLeft: `4px solid ${color}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                              <div style={{ fontSize: '20px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px' }}>
                                {icon}
                              </div>
                              <div className="food-info">
                                <h4 style={{ fontSize: '14px', fontWeight: 600 }}>{item.name || (item.type === 'sleep' ? t('sleep') : item.type)}</h4>
                                <div className="food-stats" style={{ marginTop: '2px', fontSize: '12px', opacity: 0.8 }}>
                                  {stats}
                                </div>
                              </div>
                              <div style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.4 }}>
                                {format(new Date(item.date), 'HH:mm')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
                              {item.type === 'food' && (
                                <button
                                  className="icon-btn"
                                  title={language === 'en' ? 'Log again' : 'บันทึกซ้ำ'}
                                  onClick={() => {
                                    const foodItem = foods.find(f => f.id === item.id);
                                    if (foodItem) handleReLogFood(foodItem);
                                  }}
                                  style={{ width: '32px', height: '32px' }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                              )}
                              {canEdit && (
                                <button className="icon-btn" onClick={() => {
                                  if (item.type === 'food') {
                                    const foodItem = foods.find(f => f.id === item.id);
                                    if (foodItem) openEditModal(foodItem);
                                  } else if (item.type === 'exercise') {
                                    const exItem = exerciseRecords.find(e => e.id === item.id);
                                    if (exItem) setEditingExercise(exItem);
                                  } else if (item.type === 'sleep') {
                                    const slItem = sleepRecords.find(s => s.id === item.id);
                                    if (slItem) setEditingSleep(slItem);
                                  }
                                }} style={{ width: '32px', height: '32px' }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                              )}
                              <button className="icon-btn delete-btn-hover" onClick={() => {
                                if (item.type === 'food') handleDeleteFood(item.id);
                                else if (item.type === 'exercise') handleDeleteExercise(item.id);
                                else if (item.type === 'sleep') handleDeleteSleep(item.id);
                              }} style={{ width: '32px', height: '32px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </motion.div>

          <motion.div
            className="layout-column home-sidebar"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            <HydrationCard
              title={t('hyd')}
              goalLabel={t('hydrationGoal')}
              glassesLabel={t('glasses')}
              remainingLabel={t('remaining')}
              waterGlasses={waterGlasses}
              hydrationGoal={hydrationGoal}
              waterPercent={waterPercent}
              waterRemaining={waterRemaining}
              decrementAriaLabel={language === 'en' ? 'Remove water' : 'ลดน้ำ'}
              incrementAriaLabel={language === 'en' ? 'Add water' : 'เพิ่มน้ำ'}
              onDecrement={() => handleUpdateWater(-1)}
              onIncrement={() => handleUpdateWater(1)}
            />

            <QuickActionsRow
              title={t('quickActions')}
              addFoodLabel={t('addFood')}
              logActivityLabel={t('logActivity')}
              onAddFood={() => {
                haptic("medium");
                setLogModalTab('food');
                setIsActionModalOpen(true);
              }}
              onLogActivity={() => {
                haptic("medium");
                setLogModalTab('exercise');
                setIsActionModalOpen(true);
              }}
            />

            <QuickAddSection
              title={t('quickAdd')}
              foods={recentFoods}
              onQuickAdd={handleQuickAdd}
            />
          </motion.div>

          <motion.div
            className="layout-column home-feed mobile-feed-only"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <TodayFeedSection
              title={t('todayFeed')}
              loading={loading}
              items={unifiedHistory}
              foods={foods}
              exerciseRecords={exerciseRecords}
              sleepRecords={sleepRecords}
              noItemsTitle={t('noFoodLogged')}
              noItemsMessage={t('tapFoodButton')}
              sleepLabel={t('sleep')}
              goodQualityLabel={t('goodQuality')}
              fairQualityLabel={t('fairQuality')}
              poorQualityLabel={t('poorQuality')}
              relogTitle={language === 'en' ? 'Log again' : 'บันทึกซ้ำ'}
              onRelogFood={handleReLogFood}
              onEditFood={openEditModal}
              onEditExercise={setEditingExercise}
              onEditSleep={setEditingSleep}
              onDeleteFood={handleDeleteFood}
              onDeleteExercise={handleDeleteExercise}
              onDeleteSleep={handleDeleteSleep}
            />

            <div className="bottom-nav-spacer" style={{ height: '80px' }} />
          </motion.div>
        </div>
      </div>

      {/* Add Action Modal */}
      {isActionModalOpen && (
        <div className="modal-overlay" onClick={() => setIsActionModalOpen(false)}>
          <div className="glass-panel modal-content add-log-modal" onClick={e => e.stopPropagation()}>

            <div className="add-log-modal-header">
              <div className="add-log-modal-tabs">
                {([
                  { key: 'food' as const, label: t('addFood'), color: '#10b981', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z' },
                  { key: 'exercise' as const, label: t('trainingTab'), color: '#f97316', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
                  { key: 'sleep' as const, label: t('recoveryTab'), color: '#8b5cf6', icon: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z' },
                  { key: 'measurements' as const, label: t('logMeasurements'), color: '#06b6d4', icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' },
                ]).map((tab, idx) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setLogModalTab(tab.key)}
                    className={`add-log-tab ${logModalTab === tab.key ? 'active' : ''}`}
                    style={{ '--tab-color': tab.color } as React.CSSProperties}
                  >
                    <div className="add-log-tab-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {tab.key === 'food' && <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>}
                        {tab.key === 'exercise' && <><path d="M18 13v-2a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M12 3v18"/><path d="M6 8l4-4 4 4"/></>}
                        {tab.key === 'sleep' && <><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/></>}
                        {tab.key === 'measurements' && <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>}
                      </svg>
                    </div>
                    <span className="add-log-tab-label">{tab.label}</span>
                    <div className="add-log-tab-indicator" />
                  </button>
                ))}
              </div>
              <button onClick={() => setIsActionModalOpen(false)} className="add-log-close-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="add-log-modal-title">
              <h3>{logModalTab === 'food' ? t('addFood') : logModalTab === 'exercise' ? t('logActivityTitle') : logModalTab === 'sleep' ? t('logSleep') : t('logMeasurements')}</h3>
            </div>

            {logModalTab === 'food' && (
              <div className="modal-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  <input 
                    type="text" 
                    placeholder={language === 'en' ? "Optional: Enter dish name before scanning" : "(ตัวเลือก) พิมพ์ชื่อเมนูอาหารก่อนสแกน"} 
                    value={scanHint} 
                    onChange={(e) => setScanHint(e.target.value)} 
                    style={{ height: '36px', fontSize: '13px', padding: '0 12px', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', width: '100%' }} 
                  />
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={() => setIsScanning(!isScanning)}
                      className={`add-log-action-btn ${isScanning ? 'active scanning' : ''}`}
                      style={{ flex: 1, height: '36px', borderRadius: '10px', fontSize: '12px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
                      {isScanning ? t('stopBtn') : t('scanBtn')}
                    </button>

                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageScan}
                        style={{ display: 'none' }}
                        id="ai-scan-input"
                      />
                      <label
                        htmlFor="ai-scan-input"
                        className="add-log-action-btn ai-scan-btn"
                        style={{ width: '100%', margin: 0, height: '36px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', cursor: 'pointer' }}
                      >
                        {aiLoading
                          ? aiStage === 'compressing' ? '⏳ ' + (language === 'en' ? 'Compressing...' : 'กำลังบีบอัด...')
                          : '🔍 ' + (language === 'en' ? 'Analyzing...' : 'กำลังวิเคราะห์...')
                          : t('aiScanBtn')}
                      </label>
                    </div>
                  </div>
                </div>

                {/* AI Progress Indicator */}
                {aiLoading && (
                  <div style={{ marginBottom: '8px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {(['compressing', 'analyzing', 'done'] as const).map((stage, i) => {
                        const stageIdx = ['compressing', 'analyzing', 'done'].indexOf(aiStage);
                        const isDone = i < stageIdx;
                        const isActive = i === stageIdx;
                        const labels = language === 'en'
                          ? ['Compressing', 'Analyzing', 'Done']
                          : ['บีบอัดรูป', 'วิเคราะห์', 'เสร็จแล้ว'];
                        return (
                          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                            <div style={{
                              width: '100%', height: '4px', borderRadius: '4px',
                              background: isDone ? 'var(--accent-cal)' : isActive ? 'var(--accent-pro)' : 'rgba(255,255,255,0.1)',
                              transition: 'background 0.4s ease'
                            }} />
                            {i === 2 && <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '4px' }}>{labels[i]}</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      {aiStage === 'compressing' ? (language === 'en' ? 'Compressing image for faster upload...' : 'กำลังบีบอัดรูปภาพ...') : (language === 'en' ? 'AI is analyzing nutritional content...' : 'AI กำลังวิเคราะห์คุณค่าทางโภชนาการ...')}
                    </div>
                  </div>
                )}

                {/* AI Confidence Badge */}
                {!aiLoading && aiConfidence !== null && foodInputs.name && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '10px', marginBottom: '8px',
                    background: aiConfidence >= 80 ? 'rgba(130,166,125,0.12)' : aiConfidence >= 50 ? 'rgba(251,191,36,0.10)' : 'rgba(249,115,22,0.10)',
                    border: `1px solid ${aiConfidence >= 80 ? 'rgba(130,166,125,0.3)' : aiConfidence >= 50 ? 'rgba(251,191,36,0.3)' : 'rgba(249,115,22,0.3)'}`,
                  }}>
                    <div style={{ fontSize: '16px' }}>{aiConfidence >= 80 ? '✅' : aiConfidence >= 50 ? '⚠️' : '🔶'}</div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: aiConfidence >= 80 ? 'var(--accent-cal)' : aiConfidence >= 50 ? '#fbbf24' : '#f97316' }}>
                        {aiConfidence >= 80
                          ? (language === 'en' ? 'High confidence' : 'มั่นใจสูง')
                          : aiConfidence >= 50
                          ? (language === 'en' ? 'Review recommended' : 'แนะนำให้ตรวจสอบ')
                          : (language === 'en' ? 'Low confidence — please verify' : 'ความมั่นใจต่ำ — กรุณาตรวจสอบ')}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {language === 'en' ? `AI confidence: ${aiConfidence}%` : `ความมั่นใจ AI: ${aiConfidence}%`}
                      </div>
                    </div>
                  </div>
                )}

                {/* Barcode Preview Card */}
                {barcodePreview && (
                  <div style={{ marginBottom: '10px', padding: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '14px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px' }}>
                      {barcodePreview.imageUrl && (
                        <img src={barcodePreview.imageUrl} alt={barcodePreview.name} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '2px', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.3, marginBottom: '2px' }}>{barcodePreview.name}</div>
                        {barcodePreview.brand && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{barcodePreview.brand}</div>}
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {barcodePreview.kcalPer100g} kcal / 100g &nbsp;|&nbsp; P:{barcodePreview.proteinPer100g}g &nbsp;C:{barcodePreview.carbsPer100g}g &nbsp;F:{barcodePreview.fatPer100g}g
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {language === 'en' ? 'Serving (g):' : 'ปริมาณ (ก.):'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={2000}
                        value={barcodeServing}
                        onChange={e => setBarcodeServing(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ flex: 1, height: '34px', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', padding: '0 8px', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cal)', whiteSpace: 'nowrap' }}>
                        = {Math.round(barcodePreview.kcalPer100g * barcodeServing / 100)} kcal
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setBarcodePreview(null)} className="glass-btn" style={{ flex: 1, height: '36px', borderRadius: '10px', fontSize: '12px' }}>
                        {language === 'en' ? 'Cancel' : 'ยกเลิก'}
                      </button>
                      <button onClick={confirmBarcodePreview} className="primary-btn active" style={{ flex: 2, height: '36px', borderRadius: '10px', fontSize: '12px', margin: 0 }}>
                        {language === 'en' ? 'Confirm & Fill Form' : 'ยืนยัน & กรอกฟอร์ม'}
                      </button>
                    </div>
                  </div>
                )}

                {isScanning && (
                  <div style={{ marginBottom: '8px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--panel-border)', background: '#000', position: 'relative', height: '140px' }}>
                    <video ref={zxingRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate( -50%, -50%)', width: '120px', height: '80px', border: '2px solid var(--accent-pro)', borderRadius: '12px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)' }}></div>
                  </div>
                )}

                <form id="add-food-form" onSubmit={(e) => { handleAddFood(e); setIsActionModalOpen(false); }}>
                  <div className="input-group" style={{ position: 'relative', marginBottom: '8px', width: '100%' }}>
                    <input
                      type="text"
                      required
                      placeholder={t('foodPlaceholder')}
                      value={foodInputs.name}
                      onChange={e => {
                        setFoodInputs({ ...foodInputs, name: e.target.value });
                        handleSearch(e.target.value);
                      }}
                      style={{ height: '40px', fontSize: '14px', padding: '0 12px', borderRadius: '12px', width: '100%' }}
                      onBlur={() => setTimeout(() => setSearchResults([]), 200)}
                    />
                    {searchResults.length > 0 && (
                      <div className="glass-panel" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        marginTop: '4px',
                        padding: '6px',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        borderRadius: '12px'
                      }}>
                        {searchResults.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => selectSearchResult(item)}
                            className="search-result-item"
                            style={{
                              padding: '8px 10px',
                              cursor: 'pointer',
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                                P:{item.protein}g | C:{item.carbs}g | F:{item.fat}g
                              </div>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--accent-cal)' }}>{item.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="input-row" style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <select
                      value={foodInputs.mealCategory}
                      onChange={e => setFoodInputs({ ...foodInputs, mealCategory: e.target.value })}
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <option value="Breakfast">🍳 {t('breakfast')}</option>
                      <option value="Lunch">🥗 {t('lunch')}</option>
                      <option value="Dinner">🍲 {t('dinner')}</option>
                      <option value="Snack">🍪 {t('snack')}</option>
                    </select>
                    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => setOpenCalendar(openCalendar === 'food' ? null : 'food')}
                        className="form-input-btn"
                        style={{ width: '100%' }}
                      >
                        <span>📅 {foodInputs.date}</span>
                        <span className="icon-sm">▼</span>
                      </button>
                      {openCalendar === 'food' && (
                        <CalendarPicker
                          value={foodInputs.date}
                          onChange={(d) => setFoodInputs({ ...foodInputs, date: d })}
                          onClose={() => setOpenCalendar(null)}
                        />
                      )}
                    </div>
                  </div>

                  <div className="input-row" style={{ marginBottom: '8px' }}>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder={t('calories')}
                      value={foodInputs.calories}
                      onChange={e => setFoodInputs({ ...foodInputs, calories: e.target.value })}
                      style={{ height: '40px', padding: '0 12px', borderRadius: '12px', width: '100%', fontSize: '14px' }}
                    />
                  </div>

                  <div className="macro-inputs" style={{ marginBottom: '12px', gap: '8px', display: 'flex', flexDirection: 'row' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        required
                        value={foodInputs.protein}
                        onChange={e => setFoodInputs({ ...foodInputs, protein: e.target.value })}
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>P</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={foodInputs.carbs}
                        onChange={e => setFoodInputs({ ...foodInputs, carbs: e.target.value })}
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>C</span>
                    </div>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="number"
                        value={foodInputs.fat}
                        onChange={e => setFoodInputs({ ...foodInputs, fat: e.target.value })}
                        placeholder="0"
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>F</span>
                    </div>
                  </div>

                  <button type="submit" className="add-log-btn add-log-btn-food" disabled={loading} style={{ width: '100%', height: '44px', borderRadius: '14px', fontSize: '14px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    <span>{t('addFoodBtn')}</span>
                  </button>
                </form>
              </div>
            )}

            {logModalTab === 'exercise' && (
              <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder={t('activityPlaceholder')}
                    value={exerciseInput.name}
                    onChange={e => setExerciseInput({ ...exerciseInput, name: e.target.value })}
                    style={{ height: '44px', borderRadius: '12px', fontSize: '14px' }}
                  />
                </div>
                <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => setOpenCalendar(openCalendar === 'exercise' ? null : 'exercise')}
                      className="form-input-btn"
                      style={{ width: '100%' }}
                    >
                      <span>📅 {exerciseInput.date}</span>
                      <span className="icon-sm">▼</span>
                    </button>
                    {openCalendar === 'exercise' && (
                      <CalendarPicker
                        value={exerciseInput.date}
                        onChange={(d) => setExerciseInput({ ...exerciseInput, date: d })}
                        onClose={() => setOpenCalendar(null)}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                    <input
                      type="number"
                      placeholder={t('minutes')}
                      value={exerciseInput.durationMinutes || ''}
                      onChange={e => setExerciseInput({ ...exerciseInput, durationMinutes: Number(e.target.value) })}
                      style={{ paddingRight: '44px' }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{t('unitMin').toUpperCase()}</span>
                  </div>
                </div>
                <div className="input-row" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      placeholder={t('caloriesBurnedPlc')}
                      value={exerciseInput.caloriesBurned || ''}
                      onChange={e => setExerciseInput({ ...exerciseInput, caloriesBurned: Number(e.target.value) })}
                      style={{ height: '44px', borderRadius: '12px', paddingRight: '44px', fontSize: '14px' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-cal)', fontWeight: 800 }}>{t('unitKcal').toUpperCase()}</span>
                  </div>
                </div>
                <button onClick={(e) => { handleLogExercise(); setIsActionModalOpen(false); }} className="add-log-btn add-log-btn-exercise">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v-2a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M12 3v18"/><path d="M6 8l4-4 4 4"/></svg>
                  {t('logActivityBtn')}
                </button>
              </div>
            )}

            {logModalTab === 'sleep' && (
              <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="input-row" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      placeholder={t('hours')}
                      value={sleepInput.durationHours || ''}
                      onChange={e => setSleepInput({ ...sleepInput, durationHours: Number(e.target.value) })}
                      style={{ height: '44px', borderRadius: '12px', paddingRight: '36px', fontSize: '14px' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-fat)', fontWeight: 800 }}>{t('unitHr').toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      placeholder={t('minutes')}
                      value={sleepInput.durationMinutes || ''}
                      onChange={e => setSleepInput({ ...sleepInput, durationMinutes: Number(e.target.value) })}
                      style={{ height: '44px', borderRadius: '12px', paddingRight: '40px', fontSize: '14px' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-fat)', fontWeight: 800 }}>{t('unitMin').toUpperCase()}</span>
                  </div>
                </div>
                <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                    <button
                      type="button"
                      onClick={() => setOpenCalendar(openCalendar === 'sleep' ? null : 'sleep')}
                      className="form-input-btn"
                      style={{ width: '100%' }}
                    >
                      <span>📅 {sleepInput.date}</span>
                      <span className="icon-sm">▼</span>
                    </button>
                    {openCalendar === 'sleep' && (
                      <CalendarPicker
                        value={sleepInput.date}
                        onChange={(d) => setSleepInput({ ...sleepInput, date: d })}
                        onClose={() => setOpenCalendar(null)}
                      />
                    )}
                  </div>
                  <select
                    value={sleepInput.quality}
                    onChange={e => setSleepInput({ ...sleepInput, quality: e.target.value })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <option value="Good">😊 {t('goodQuality')}</option>
                    <option value="Fair">😐 {t('fairQuality')}</option>
                    <option value="Poor">😴 {t('poorQuality')}</option>
                  </select>
                </div>
                <button onClick={(e) => { handleLogSleep(); setIsActionModalOpen(false); }} className="add-log-btn add-log-btn-sleep">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/></svg>
                  {t('recordSleepBtn')}
                </button>
              </div>
            )}

            {logModalTab === 'measurements' && (
              <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="input-row" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={measurementInput.weight}
                      onChange={e => setMeasurementInput({ ...measurementInput, weight: e.target.value })}
                      style={{ height: '44px', borderRadius: '12px', paddingRight: '36px', fontSize: '14px' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-cal)', fontWeight: 800 }}>KG</span>
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="number"
                      placeholder="0.0"
                      value={measurementInput.waist}
                      onChange={e => setMeasurementInput({ ...measurementInput, waist: e.target.value })}
                      style={{ height: '44px', borderRadius: '12px', paddingRight: '36px', fontSize: '14px' }}
                    />
                    <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-pro)', fontWeight: 800 }}>CM</span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={measurementInput.bodyFat}
                    onChange={e => setMeasurementInput({ ...measurementInput, bodyFat: e.target.value })}
                    style={{ height: '44px', borderRadius: '12px', width: '100%', paddingRight: '36px', fontSize: '14px' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--accent-fat)', fontWeight: 800 }}>%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
                    {language === 'en' ? 'Progress Photo (optional)' : 'รูปภาพ (ตัวเลือก)'}
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label
                      htmlFor="measurement-photo-input"
                      style={{ flex: 1, height: '44px', borderRadius: '12px', border: '1px dashed var(--panel-border)', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', gap: '6px' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                      {uploadingPhoto ? (language === 'en' ? 'Uploading...' : 'กำลังอัปโหลด...') : photoUrl ? (language === 'en' ? 'Photo attached' : 'แนบรูปแล้ว') : (language === 'en' ? 'Upload photo' : 'อัปโหลดรูป')}
                    </label>
                    <input type="file" id="measurement-photo-input" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    {photoUrl && (
                      <button onClick={() => setPhotoUrl('')} className="icon-btn" style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={() => { handleLogMeasurement(); setIsActionModalOpen(false); }} className="add-log-btn add-log-btn-measurements">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {t('saveMeasurements')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {detailView && (
        <div className="modal-overlay" onClick={() => setDetailView(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-drag-handle" />
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>
                {detailView === 'training' ? t('recentHistory') : t('recentHistory')}
              </h3>
              <button onClick={() => setDetailView(null)} className="icon-btn" style={{ borderRadius: '50%', width: '32px', height: '32px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {detailView === 'training' ? (
                exerciseRecords.length > 0 ? (
                  exerciseRecords.map(ex => (
                    <div key={ex.id} className="food-item" style={{ padding: '12px 16px', borderLeft: '3px solid #f43f5e' }}>
                      <div className="food-info">
                        <h4 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {ex.name}
                          <span style={{ fontSize: '10px', opacity: 0.5, fontWeight: 400 }}>
                            {format(new Date(ex.date), 'MMM d')}
                          </span>
                        </h4>
                        <div className="food-stats" style={{ marginTop: '2px', fontSize: '12px' }}>
                          <span><strong>{ex.durationMinutes}</strong> {t('mins').toLowerCase()}</span>
                          <span style={{ color: 'var(--accent-cal)' }}><strong>{ex.caloriesBurned}</strong> kcal</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="icon-btn" onClick={() => setEditingExercise(ex)} style={{ width: '32px', height: '32px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button className="icon-btn" onClick={() => handleDeleteExercise(ex.id)} style={{ width: '32px', height: '32px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>{t('noTrainingToday')}</p>
                )
              ) : (
                sleepRecords.length > 0 ? (
                  sleepRecords.map(sl => (
                    <div key={sl.id} className="food-item" style={{ padding: '12px 16px', borderLeft: '3px solid var(--accent-fat)' }}>
                      <div className="food-info">
                        <h4 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {Math.round(sl.durationHours * 10) / 10} {t('hours').toLowerCase()}
                          <span style={{ fontSize: '10px', opacity: 0.5, fontWeight: 400 }}>
                            {format(new Date(sl.date), 'MMM d')}
                          </span>
                        </h4>
                        <div className="food-stats" style={{ marginTop: '2px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--accent-fat)' }}>Quality: <strong>{sl.quality}</strong></span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="icon-btn" onClick={() => setEditingSleep(sl)} style={{ width: '32px', height: '32px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button className="icon-btn" onClick={() => handleDeleteSleep(sl.id)} style={{ width: '32px', height: '32px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>{t('noSleepToday')}</p>
                )
              )}
            </div>

            <button
              onClick={() => {
                setLogModalTab(detailView === 'training' ? 'exercise' : 'sleep');
                setIsActionModalOpen(true);
                setDetailView(null);
              }}
              className="primary-btn active"
              style={{ marginTop: '24px', width: '100%', height: '48px', borderRadius: '14px', fontSize: '14px' }}
            >
              {detailView === 'training' ? t('logNewActivity') : t('logNewSleep')}
            </button>
          </div>
        </div>
      )}

      {/* Edit Food Modal */}
      {editingFood && (
        <div className="modal-overlay" onClick={() => setEditingFood(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-drag-handle" />
            <div className="modal-header">
              <h3>{t('editEntry')}</h3>
              <button onClick={() => setEditingFood(null)} className="icon-btn">&times;</button>
            </div>
            <form onSubmit={handleEditFoodSubmit}>
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <input type="text" required placeholder={t('foodPlaceholder')} value={editInputs.name} onChange={e => setEditInputs({ ...editInputs, name: e.target.value })} />
              </div>
              <div className="input-row" style={{ marginBottom: '12px' }}>
                <div className="input-group">
                  <select
                    value={editInputs.mealCategory}
                    onChange={e => setEditInputs({ ...editInputs, mealCategory: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Breakfast">🍳 {t('breakfast')}</option>
                    <option value="Lunch">🥗 {t('lunch')}</option>
                    <option value="Dinner">🍲 {t('dinner')}</option>
                    <option value="Snack">🍪 {t('snack')}</option>
                  </select>
                </div>
                <div className="input-group">
                  <input type="number" required min="0" placeholder={t('calories')} value={editInputs.calories} onChange={e => setEditInputs({ ...editInputs, calories: e.target.value })} />
                </div>
              </div>
              <div className="input-row" style={{ marginBottom: '24px' }}>
                <div className="input-group">
                  <input type="number" required min="0" step="0.1" placeholder={`${t('protein')} (g)`} value={editInputs.protein} onChange={e => setEditInputs({ ...editInputs, protein: e.target.value })} />
                </div>
                <div className="input-group">
                  <input type="number" min="0" step="0.1" placeholder={`${t('carbs')} (g)`} value={editInputs.carbs} onChange={e => setEditInputs({ ...editInputs, carbs: e.target.value })} />
                </div>
                <div className="input-group">
                  <input type="number" min="0" step="0.1" placeholder={`${t('fat')} (g)`} value={editInputs.fat} onChange={e => setEditInputs({ ...editInputs, fat: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="primary-btn" style={{ width: '100%' }}>{t('saveChanges')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exercise Modal */}
      {editingExercise && (
        <div className="modal-overlay" onClick={() => setEditingExercise(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-drag-handle" />
            <div className="modal-header">
              <h3>{t('editExercise')}</h3>
              <button onClick={() => setEditingExercise(null)} className="icon-btn">&times;</button>
            </div>
            <form onSubmit={handleEditExerciseSubmit}>
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <input type="text" required value={editingExercise.name} onChange={e => setEditingExercise({ ...editingExercise, name: e.target.value })} />
              </div>
              <div className="input-row" style={{ marginBottom: '12px' }}>
                <div className="input-group">
                  <input type="number" required min="0" placeholder={t('minutes')} value={editingExercise.durationMinutes} onChange={e => setEditingExercise({ ...editingExercise, durationMinutes: Number(e.target.value) })} />
                </div>
                <div className="input-group">
                  <input type="number" min="0" placeholder={t('caloriesBurnedPlc')} value={editingExercise.caloriesBurned} onChange={e => setEditingExercise({ ...editingExercise, caloriesBurned: Number(e.target.value) })} title="Optional: calories burned" />
                </div>
              </div>
              <button type="submit" className="primary-btn" style={{ width: '100%' }}>{t('saveChanges')}</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sleep Modal */}
      {editingSleep && (
        <div className="modal-overlay" onClick={() => setEditingSleep(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-drag-handle" />
            <div className="modal-header">
              <h3>{t('editSleep')}</h3>
              <button onClick={() => setEditingSleep(null)} className="icon-btn">&times;</button>
            </div>
            <form onSubmit={handleEditSleepSubmit}>
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <input type="number" step="0.1" required value={editingSleep.durationHours} onChange={e => setEditingSleep({ ...editingSleep, durationHours: Number(e.target.value) })} />
              </div>
              <div className="input-group" style={{ marginBottom: '24px' }}>
                <select value={editingSleep.quality} onChange={e => setEditingSleep({ ...editingSleep, quality: e.target.value })} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)', width: '100%' }}>
                  <option value="Good">{t('goodQuality')}</option>
                  <option value="Fair">{t('fairQuality')}</option>
                  <option value="Poor">{t('poorQuality')}</option>
                </select>
              </div>
              <button type="submit" className="primary-btn" style={{ width: '100%' }}>{t('saveChanges')}</button>
            </form>
          </div>
        </div>
      )}


      <ParticleBurst trigger={burstTrigger} originX={burstPos.x} originY={burstPos.y} colors={burstColors} count={16} />
      <SuccessAnimation trigger={!!successVariant} variant={successVariant || "food"} onComplete={() => setSuccessVariant(null)} />
    </div>
  );
}
