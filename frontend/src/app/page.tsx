"use client";

import { useState, useEffect, useRef } from "react";
import useSWR, { mutate } from "swr";
import Link from "next/link";
import Image from "next/image";
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
import LoadingSkeleton from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import TiltCard from "@/components/TiltCard";
import ParticleBurst from "@/components/ParticleBurst";
import TourOverlay from "@/components/TourOverlay";
import StreakBadge from "@/components/StreakBadge";
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
  const { user, logout, refreshUser, isLoading: authLoading } = useAuth();
  const { showToast, showUndoToast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [foods, setFoods] = useState<Food[]>([]);
  const [goals, setGoals] = useState<Goals>({ calories: 2000, protein: 150, carbs: 250, fat: 70, sugar: 50, sodium: 2000, fiber: 30 });

  const [foodInputs, setFoodInputs] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast", date: format(new Date(), 'yyyy-MM-dd') });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
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
  const [logModalTab, setLogModalTab] = useState<'food' | 'exercise' | 'sleep'>('food');
  const [detailView, setDetailView] = useState<'training' | 'recovery' | null>(null);
  const [tourStep, setTourStep] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [successVariant, setSuccessVariant] = useState<"food" | "exercise" | "sleep" | "water" | null>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const [burstPos, setBurstPos] = useState({ x: '50%', y: '50%' });
  const [burstColors, setBurstColors] = useState<string[]>(['#0ea5e9', '#f43f5e', '#a855f7', '#ffffff']);
  const [openCalendar, setOpenCalendar] = useState<"food" | "exercise" | "sleep" | null>(null);

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

            setFoodInputs(prev => ({
              ...prev,
              name: p.product_name || `Scanned (${text.substring(0, 6)})`,
              calories: String(Math.round(nutris['energy-kcal_serving'] || nutris['energy-kcal_100g'] || 0)),
              protein: String(Math.round(nutris['proteins_serving'] || nutris['proteins_100g'] || 0)),
              carbs: String(Math.round(nutris['carbohydrates_serving'] || nutris['carbohydrates_100g'] || 0)),
              fat: String(Math.round(nutris['fat_serving'] || nutris['fat_100g'] || 0)),
              sugar: String(Math.round(nutris['sugars_serving'] || nutris['sugars_100g'] || 0)),
              sodium: String(Math.round((nutris['sodium_serving'] || nutris['sodium_100g'] || 0) * 1000)),
              fiber: String(Math.round(nutris['fiber_serving'] || nutris['fiber_100g'] || 0))
            }));

            showToast(`Loaded: ${p.product_name || 'Product'}`, "success");
          } else {
            showToast("Product not found", "error");
            setError(`Not found: ${text}`);
          }
        })
        .catch(err => {
          console.error("Scanner Error:", err);
          showToast("Failed to fetch product data", "error");
        })
        .finally(() => {
          setAiLoading(false);
        });
    },
    paused: !isScanning,
  });

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

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
          mealCategory: foodInputs.mealCategory,
          date: getCompositeDate(foodInputs.date)
        })
      });

      if (res.ok) {
        const newFood = await res.json();
        setFoods([newFood, ...foods]); // Add to top matching our DB sort
        setFoodInputs({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast", date: format(new Date(), 'yyyy-MM-dd') });
        showToast(`Added ${name}!`, "success");
        setSuccessVariant("food");
        setBurstPos({ x: '50%', y: '85%' });
        setBurstColors(['#f43f5e', '#fb7185', '#fda4af']);
        setBurstTrigger(prev => prev + 1);
        setTimeout(() => setSuccessVariant(null), 1600);
        mutate(`${API_BASE}/dashboard/summary?lang=${language}`);
        refreshUser();
      }
    } catch (err) {
      console.error(err);
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
    setError(null);

    const formData = new FormData();
    formData.append("language", language);
    try {
      const compressedBlob = await compressImage(file);
      formData.append("image", compressedBlob, "image.jpg");
    } catch (err) {
      console.warn("Compression failed, uploading original:", err);
      formData.append("image", file);
    }

    try {
      const res = await fetch(`${API_BASE}/analyze-image`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const text = await res.text();
        // The AI might return JSON inside backticks sometimes, let's clean it
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonStr);
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
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to analyze image");
      }
    } catch (err) {
      console.error(err);
      setError("AI Service unavailable or invalid response");
    } finally {
      setAiLoading(false);
      if (e.target) e.target.value = ""; // Reset input
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

  // Bar Calculations
  const proPercent = Math.min(100, Math.max(0, (proTotal / goals.protein) * 100));
  const carbPercent = Math.min(100, Math.max(0, (carbTotal / goals.carbs) * 100));
  const fatPercent = Math.min(100, Math.max(0, (fatTotal / goals.fat) * 100));

  const isGoalPro = proTotal >= goals.protein;
  const isGoalCarb = carbTotal >= goals.carbs;
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
            message={error}
            onRetry={() => { setError(null); mutate(`${API_BASE}/dashboard/summary?lang=${language}`); }}
            retryLabel={t('retry')}
          />
        )}


        <header className="glass-panel main-header" style={{ borderRadius: '28px', padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 20px rgba(255,255,255,0.1)' }}>
              <Image
                src="/logo.png"
                alt="SomDun Logo"
                fill
                style={{ objectFit: 'contain', padding: '4px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '28px', margin: 0 }}>SomDun</h1>
                <span className="level-badge">LVL {level}</span>
                {(user?.streakDays || 0) > 0 && (
                  <StreakBadge days={user?.streakDays || 0} size="sm" label="Streak" />
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="xp-bar-container" style={{ width: '120px' }}>
                  <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }}></div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', opacity: 0.8 }}>{currentLevelXP} / 1000 XP</span>
              </div>
            </div>
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              href="/ai-chat"
              className="icon-btn active"
              style={{
                background: 'var(--accent-cal-gradient)',
                border: 'none',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(244, 63, 94, 0.3)'
              }}
              title="Ask AI"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M9 10l2 2 4-4"></path></svg>
            </Link>
            <button
              id="add-action-btn"
              onClick={() => { haptic("medium"); setLogModalTab('food'); setIsActionModalOpen(true); }}
              className="icon-btn active mobile-hidden"
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={t('quickAdd')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button
              onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
              className="icon-btn"
              style={{ fontSize: '14px', fontWeight: '800' }}
              title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
            >
              {language === 'en' ? 'TH' : 'EN'}
            </button>
            <Link id="player-card-section" href="/player-card" className="icon-btn" title="Player Card">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
            </Link>
            <Link id="analytics-section" href="/dashboard" className="icon-btn" title={t('analyticsTitle')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </Link>
            <Link href="/profile" className="icon-btn mobile-hidden" title={t('profileSettings')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </Link>
          </div>
        </header>

        <div className="responsive-layout">
          <motion.div
            className="layout-column"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >


            {/* Performance Rings */}
            <div className="glass-panel depth-card-3d" style={{ padding: '24px', borderRadius: '28px', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'relative', width: '140px', height: '140px' }}>
                {/* Concentric Rings - SVG */}
                <svg width="140" height="140" viewBox="0 0 140 140">
                  {/* Backgrounds */}
                  <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle cx="70" cy="70" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle cx="70" cy="70" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle cx="70" cy="70" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />

                  {/* Progress Rings */}
                  {/* Nutrition (Outer) */}
                  <circle className="grow-cal" cx="70" cy="70" r="62" fill="none" stroke="var(--accent-cal)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${Math.min(100, (foods.reduce((sum, f) => sum + f.calories, 0) / goals.calories) * 100) * 3.89} 389`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease-out', filter: 'drop-shadow(0 0 5px var(--accent-cal))' }}
                  />
                  {/* Hydration */}
                  <circle className="glow-pro" cx="70" cy="70" r="48" fill="none" stroke="#38bdf8" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${Math.min(100, (waterGlasses / 8) * 100) * 3.01} 301`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease-out', transitionDelay: '0.2s', filter: 'drop-shadow(0 0 5px #38bdf8)' }}
                  />
                  {/* Fitness */}
                  <circle className="glow-pro" cx="70" cy="70" r="34" fill="none" stroke="var(--accent-pro)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${Math.min(100, (exerciseToday / 30) * 100) * 2.13} 213`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease-out', transitionDelay: '0.4s', filter: 'drop-shadow(0 0 5px var(--accent-pro))' }}
                  />
                  {/* Recovery (Inner) */}
                  <circle className="glow-fat" cx="70" cy="70" r="20" fill="none" stroke="var(--accent-fat)" strokeWidth="12" strokeLinecap="round"
                    strokeDasharray={`${Math.min(100, (sleepToday / 8) * 100) * 1.25} 125`}
                    transform="rotate(-90 70 70)"
                    style={{ transition: 'stroke-dasharray 1s ease-out', transitionDelay: '0.6s', filter: 'drop-shadow(0 0 5px var(--accent-fat))' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '50%' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cal)' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('nut')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    {Math.round((calTotal / adjustedCalGoal) * 100)}%
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('hyd')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{Math.round((waterGlasses / 8) * 100)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-pro)' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('fit')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{Math.round((exerciseToday / 30) * 100)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-fat)' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('rec')}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{Math.round((sleepToday / 8) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Goals Dashboard */}
            <section className="dashboard">
              {/* Calories Card */}
              <div id="analytics-section" className="glass-panel cal-card depth-card-3d" style={{ padding: '32px' }}>
                <h2 style={{ fontSize: '18px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '16px' }}>Calories</h2>
                <div className="ring-container">
                  <svg className="progress-ring" viewBox="0 0 160 160" style={{ width: '100%', height: '100%' }}>
                    <circle className="ring-bg" strokeWidth="12" fill="transparent" r={radius} cx="80" cy="80" />
                    <circle
                      className="ring-progress"
                      strokeWidth="12"
                      fill="transparent"
                      r={radius}
                      cx="80"
                      cy="80"
                      style={{
                        strokeDasharray: `${circumference} ${circumference}`,
                        strokeDashoffset: loading ? circumference : calOffset,
                        stroke: isOverCal ? 'var(--danger)' : 'url(#cal-gradient)'
                      }}
                    />
                  </svg>
                  <div className="ring-content">
                    <span className="consumed" style={isOverCal ? {
                      color: 'var(--danger)',
                      background: 'none',
                      WebkitTextFillColor: 'var(--danger)'
                    } : {
                      background: 'var(--accent-cal-gradient)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      {calTotal}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span className="label" style={{ opacity: 0.6 }}>/ {adjustedCalGoal} kcal</span>
                      {burnedToday > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--accent-pro)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                          🔥 +{burnedToday}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="cal-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '24px' }}>
                  <div className="stat" style={{ textAlign: 'center' }}>
                    <span className="stat-value" style={{ fontSize: '16px', fontWeight: 800 }}>{goals.calories}</span>
                    <span className="stat-label" style={{ fontWeight: 700, fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>
                      {t('target')}
                    </span>
                  </div>
                  <div className="stat" style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                    <span className="stat-value" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-pro)' }}>+{burnedToday}</span>
                    <span className="stat-label" style={{ fontWeight: 700, fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>
                      {t('activeBonus')}
                    </span>
                  </div>
                  <div className="stat" style={{ textAlign: 'center' }}>
                    <span className="stat-value" style={isOverCal ? { color: 'var(--danger)', fontSize: '16px', fontWeight: 800 } : { fontSize: '16px', fontWeight: 800 }}>
                      {calRemaining}
                    </span>
                    <span className="stat-label" style={{ fontWeight: 700, fontSize: '10px', opacity: 0.6, textTransform: 'uppercase' }}>
                      {isOverCal ? t('over') : t('remaining')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Macros Progress */}
              <div className="glass-panel depth-card-3d" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px' }}>
                {/* Protein Bar */}
                <div className="pro-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                  <div className="pro-header">
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('protein')}</h2>
                    <div className="pro-values">
                      <span className="consumed">{proTotal}</span>
                      <span className="label" style={{ opacity: 0.5 }}>/ {goals.protein}g</span>
                    </div>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${proPercent}%`,
                        background: isGoalPro ? 'var(--success)' : 'var(--accent-pro-gradient)',
                        boxShadow: isGoalPro ? '0 0 12px rgba(16, 185, 129, 0.3)' : '0 0 12px rgba(14, 165, 233, 0.3)'
                      }}
                    ></div>
                  </div>
                  <p className="pro-remaining" style={{ fontSize: '12px', opacity: 0.7 }}><span>{proRemaining}</span>g left</p>
                </div>

                {/* Carb Bar */}
                <div className="pro-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                  <div className="pro-header">
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('carbs')}</h2>
                    <div className="pro-values">
                      <span className="consumed" style={{ background: 'var(--accent-carb-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{carbTotal}</span>
                      <span className="label" style={{ opacity: 0.5 }}>/ {goals.carbs}g</span>
                    </div>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${carbPercent}%`,
                        background: isGoalCarb ? 'var(--success)' : 'var(--accent-carb-gradient)',
                        boxShadow: isGoalCarb ? '0 0 12px rgba(16, 185, 129, 0.3)' : '0 0 12px rgba(196, 180, 148, 0.3)'
                      }}
                    ></div>
                  </div>
                  <p className="pro-remaining" style={{ fontSize: '12px', opacity: 0.7 }}><span>{carbRemaining}</span>g left</p>
                </div>



                {/* Fat Bar */}
                <div className="pro-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                  <div className="pro-header">
                    <h2 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('fat')}</h2>
                    <div className="pro-values">
                      <span className="consumed" style={{ background: 'var(--accent-fat-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fatTotal}</span>
                      <span className="label" style={{ opacity: 0.5 }}>/ {goals.fat}g</span>
                    </div>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '10px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${fatPercent}%`,
                        background: 'var(--accent-fat-gradient)',
                        boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)'
                      }}
                    ></div>
                  </div>
                  <p className="pro-remaining" style={{ fontSize: '12px', opacity: 0.7 }}><span>{fatRemaining}</span>g left</p>
                </div>
              </div>
            </section>

            {/* Unified Activity Feed */}
            <div className="dashboard-logs" style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
              <section className="foods-list-section">
                <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>{t('todayFeed')}</h3>
                <div className="foods-list">
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="food-item skeleton" style={{ height: '72px', border: 'none' }}></div>
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
            className="layout-column"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            {/* Quick Stats Summary */}
            <TiltCard intensity={300} maxTilt={15} glareOpacity={0.2} style={{ borderRadius: '24px' }}>
              <section className="glass-panel depth-card-3d" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('dailyProgress')}</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Water Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(14, 165, 233, 0.1)', border: 'none', color: 'var(--accent-pro)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{waterGlasses} {t('glasses')}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('hydrationGoal')}: 8</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleUpdateWater(-1)} className="glass-btn" style={{ width: '28px', height: '28px', padding: 0, borderRadius: '6px', minHeight: '28px' }}>-</button>
                      <button onClick={() => handleUpdateWater(1)} className="glass-btn active" style={{ width: '28px', height: '28px', padding: 0, borderRadius: '6px', minHeight: '28px' }}>+</button>
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      onClick={() => setDetailView('training')}
                      className="interactive-card"
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, padding: '8px', borderRadius: '12px', transition: 'all 0.2s ease', margin: '-8px' }}
                    >
                      <div className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(244, 63, 94, 0.1)', border: 'none', color: '#f43f5e' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {exerciseToday} {t('mins')}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.5 }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('totalTraining')}</div>
                      </div>
                    </div>
                  </div>

                  {/* Sleep Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div
                      onClick={() => setDetailView('recovery')}
                      className="interactive-card"
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1, padding: '8px', borderRadius: '12px', transition: 'all 0.2s ease', margin: '-8px' }}
                    >
                      <div className="icon-btn" style={{ width: '32px', height: '32px', background: 'rgba(168, 85, 247, 0.1)', border: 'none', color: 'var(--accent-fat)' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {Math.round(sleepToday * 10) / 10} {t('hours')}
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.5 }}><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t('restRecovery')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </TiltCard>


            {/* Recent Foods */}
            {recentFoods.length > 0 && (
              <section className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('quickAdd')}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {recentFoods.slice(0, 6).map((f, i) => (
                    <button key={i} onClick={() => handleQuickAdd(f)} className="glass-btn" style={{ padding: '8px 14px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--accent-pro)', fontWeight: 800 }}>+</span> {f.name}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Spacer for bottom nav */}
            <div className="bottom-nav-spacer" style={{ height: '80px' }} />
          </motion.div>
        </div>
      </div>

      {/* Add Action Modal */}
        {isActionModalOpen && (
          <div className="modal-overlay" onClick={() => setIsActionModalOpen(false)}>
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '28px 24px 32px', borderRadius: '28px', overflow: 'visible' }}>
              {/* Mobile drag handle */}
              <div className="modal-drag-handle" />

              <div className="modal-header" style={{ marginBottom: '20px', flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800 }}>
                    {logModalTab === 'food' ? t('addFood') : logModalTab === 'exercise' ? t('logActivityTitle') : t('logActivityTitle')}
                  </h3>
                  <button onClick={() => setIsActionModalOpen(false)} className="icon-btn" style={{ borderRadius: '50%', width: '36px', height: '36px', background: 'rgba(255,255,255,0.05)' }}>&times;</button>
                </div>

                {/* Tab Switcher */}
                <div className="modal-tab-switcher" style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: '14px', padding: "4px", border: '1px solid var(--panel-border)', width: '100%', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setLogModalTab('food')}
                    className={`glass-btn ${logModalTab === 'food' ? 'active' : ''}`}
                    style={{ flex: 1, border: 'none', borderRadius: '10px', minHeight: '40px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    🍎 {t('addFood')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogModalTab('exercise')}
                    className={`glass-btn ${logModalTab === 'exercise' ? 'active' : ''}`}
                    style={{ flex: 1, border: 'none', borderRadius: '10px', minHeight: '40px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    🏃 {t('trainingTab')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogModalTab('sleep')}
                    className={`glass-btn ${logModalTab === 'sleep' ? 'active' : ''}`}
                    style={{ flex: 1, border: 'none', borderRadius: '10px', minHeight: '40px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    🌙 {t('recoveryTab')}
                  </button>
                </div>
              </div>

              {logModalTab === 'food' && (
                <div className="modal-form">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                      <button
                        onClick={() => setIsScanning(!isScanning)}
                        className={`glass-btn ${isScanning ? 'active' : ''}`}
                        style={{ flex: 1, height: '48px', borderRadius: '14px', fontSize: '13px' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
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
                          className="primary-btn"
                          style={{ width: '100%', margin: 0, height: '48px', fontSize: '13px', background: 'var(--accent-pro-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', cursor: 'pointer' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                          {aiLoading ? '...' : t('aiScanBtn')}
                        </label>
                      </div>
                    </div>
                  </div>

                  {isScanning && (
                    <div style={{ marginBottom: '20px', borderRadius: '16px', overflow: 'hidden', border: '2px solid var(--panel-border)', background: '#000', position: 'relative', height: '200px' }}>
                      <video ref={zxingRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate( -50%, -50%)', width: '160px', height: '100px', border: '2px solid var(--accent-pro)', borderRadius: '12px', boxShadow: '0 0 0 1000px rgba(0,0,0,0.5)' }}></div>
                    </div>
                  )}

                  <form id="add-food-form" onSubmit={(e) => { handleAddFood(e); setIsActionModalOpen(false); }}>
                    <div className="input-group" style={{ position: 'relative', marginBottom: '16px' }}>
                      <input
                        type="text"
                        required
                        placeholder={t('foodPlaceholder')}
                        value={foodInputs.name}
                        onChange={e => {
                          setFoodInputs({ ...foodInputs, name: e.target.value });
                          handleSearch(e.target.value);
                        }}
                        style={{ height: '52px', fontSize: '16px', padding: '0 20px', borderRadius: '14px' }}
                        onBlur={() => setTimeout(() => setSearchResults([]), 200)}
                      />
                      {searchResults.length > 0 && (
                        <div className="glass-panel" style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          zIndex: 50,
                          marginTop: '8px',
                          padding: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          borderRadius: '14px'
                        }}>
                          {searchResults.map((item, idx) => (
                            <div
                              key={idx}
                              onClick={() => selectSearchResult(item)}
                              className="search-result-item"
                              style={{
                                padding: '12px 14px',
                                cursor: 'pointer',
                                borderRadius: '10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  P:{item.protein}g | C:{item.carbs}g | F:{item.fat}g
                                </div>
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-cal)' }}>{item.calories} kcal</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="input-row" style={{ marginBottom: '16px' }}>
                      <select
                        value={foodInputs.mealCategory}
                        onChange={e => setFoodInputs({ ...foodInputs, mealCategory: e.target.value })}
                        style={{ flex: 1, height: '52px', padding: '0 16px', borderRadius: '14px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontWeight: 600 }}
                      >
                        <option value="Breakfast">🍳 {t('breakfast')}</option>
                        <option value="Lunch">🥗 {t('lunch')}</option>
                        <option value="Dinner">🍲 {t('dinner')}</option>
                        <option value="Snack">🍪 {t('snack')}</option>
                      </select>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setOpenCalendar(openCalendar === 'food' ? null : 'food')}
                          style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '14px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}
                        >
                          <span>📅 {foodInputs.date}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>▼</span>
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

                    <div className="input-row" style={{ marginBottom: '16px' }}>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder={t('calories')}
                        value={foodInputs.calories}
                        onChange={e => setFoodInputs({ ...foodInputs, calories: e.target.value })}
                        style={{ height: '52px', padding: '0 16px', borderRadius: '14px' }}
                      />
                    </div>

                    <div className="macro-inputs" style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.1"
                          placeholder={t('protein')}
                          value={foodInputs.protein}
                          onChange={e => setFoodInputs({ ...foodInputs, protein: e.target.value })}
                          style={{ height: '52px', padding: '0 16px', borderRadius: '14px' }}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-pro)', fontWeight: 800 }}>G</span>
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder={t('carbs')}
                          value={foodInputs.carbs}
                          onChange={e => setFoodInputs({ ...foodInputs, carbs: e.target.value })}
                          style={{ height: '52px', padding: '0 16px', borderRadius: '14px' }}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-carb)', fontWeight: 800 }}>G</span>
                      </div>
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder={t('fat')}
                          value={foodInputs.fat}
                          onChange={e => setFoodInputs({ ...foodInputs, fat: e.target.value })}
                          style={{ height: '52px', padding: '0 16px', borderRadius: '14px' }}
                        />
                        <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-fat)', fontWeight: 800 }}>G</span>
                      </div>
                    </div>

                    <button type="submit" className="primary-btn active" disabled={loading} style={{ width: '100%', height: '56px', borderRadius: '16px' }}>
                      <span>{t('addFoodBtn')}</span>
                    </button>
                  </form>
                </div>
              )}

              {logModalTab === 'exercise' && (
                <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder={t('activityPlaceholder')}
                      value={exerciseInput.name}
                      onChange={e => setExerciseInput({ ...exerciseInput, name: e.target.value })}
                      style={{ height: '52px', borderRadius: '14px' }}
                    />
                  </div>
                  <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setOpenCalendar(openCalendar === 'exercise' ? null : 'exercise')}
                        style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '14px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}
                      >
                        <span>📅 {exerciseInput.date}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>▼</span>
                      </button>
                      {openCalendar === 'exercise' && (
                        <CalendarPicker
                          value={exerciseInput.date}
                          onChange={(d) => setExerciseInput({ ...exerciseInput, date: d })}
                          onClose={() => setOpenCalendar(null)}
                        />
                      )}
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        placeholder={t('minutes')}
                        value={exerciseInput.durationMinutes || ''}
                        onChange={e => setExerciseInput({ ...exerciseInput, durationMinutes: Number(e.target.value) })}
                        style={{ height: '52px', borderRadius: '14px', paddingRight: '48px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-pro)', fontWeight: 800 }}>{t('unitMin').toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        placeholder={t('caloriesBurnedPlc')}
                        value={exerciseInput.caloriesBurned || ''}
                        onChange={e => setExerciseInput({ ...exerciseInput, caloriesBurned: Number(e.target.value) })}
                        style={{ height: '52px', borderRadius: '14px', paddingRight: '54px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-cal)', fontWeight: 800 }}>{t('unitKcal').toUpperCase()}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { handleLogExercise(); setIsActionModalOpen(false); }} className="primary-btn active" style={{ height: '56px', borderRadius: '16px', marginTop: '8px' }}>
                    {t('logActivityBtn')}
                  </button>
                </div>
              )}

              {logModalTab === 'sleep' && (
                <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        placeholder={t('hours')}
                        value={sleepInput.durationHours || ''}
                        onChange={e => setSleepInput({ ...sleepInput, durationHours: Number(e.target.value) })}
                        style={{ height: '52px', borderRadius: '14px', paddingRight: '44px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-fat)', fontWeight: 800 }}>{t('unitHr').toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="number"
                        placeholder={t('minutes')}
                        value={sleepInput.durationMinutes || ''}
                        onChange={e => setSleepInput({ ...sleepInput, durationMinutes: Number(e.target.value) })}
                        style={{ height: '52px', borderRadius: '14px', paddingRight: '48px' }}
                      />
                      <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--accent-fat)', fontWeight: 800 }}>{t('unitMin').toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="input-row" style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setOpenCalendar(openCalendar === 'sleep' ? null : 'sleep')}
                        style={{ width: '100%', height: '52px', padding: '0 16px', borderRadius: '14px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '14px' }}
                      >
                        <span>📅 {sleepInput.date}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>▼</span>
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
                      style={{ flex: 1, height: '52px', borderRadius: '14px', border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', fontWeight: 600, padding: '0 16px', fontSize: '14px' }}
                    >
                      <option value="Good">😊 {t('goodQuality')}</option>
                      <option value="Fair">😐 {t('fairQuality')}</option>
                      <option value="Poor">😴 {t('poorQuality')}</option>
                    </select>
                  </div>
                  <button onClick={(e) => { handleLogSleep(); setIsActionModalOpen(false); }} className="primary-btn active" style={{ height: '56px', borderRadius: '16px', marginTop: '8px' }}>
                    {t('recordSleepBtn')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details View Modal */}
        {detailView && (
          <div className="modal-overlay" onClick={() => setDetailView(null)}>
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px', borderRadius: '24px' }}>
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
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
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
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
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
            <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
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
