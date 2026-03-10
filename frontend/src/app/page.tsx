"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { startOfDay, endOfDay } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useZxing } from "react-zxing";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLanguage } from "@/context/LanguageContext";

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

type UserProfile = {
  name: string;
  age: number;
  weight: number;
  height: number;
  sex: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export default function Home() {
  const { logout, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { language, setLanguage, t } = useLanguage();
  const [foods, setFoods] = useState<Food[]>([]);
  const [goals, setGoals] = useState<Goals>({ calories: 2000, protein: 150, carbs: 250, fat: 70, sugar: 50, sodium: 2000, fiber: 30 });
  const [user, setUser] = useState<UserProfile>({ name: "User", age: 25, weight: 70, height: 170, sex: "other" });

  const [foodInputs, setFoodInputs] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast" });
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [waterGlasses, setWaterGlasses] = useState(0);
  const [recentFoods, setRecentFoods] = useState<any[]>([]);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [editInputs, setEditInputs] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const { ref: zxingRef } = useZxing({
    onDecodeResult(result) {
      if (!isScanning) return;

      const text = result.getText();
      setIsScanning(false);
      setAiLoading(true); // Re-use AI loading spinner for API call
      setError(null);

      // Fetch actual data from Open Food Facts API
      fetch(`https://world.openfoodfacts.org/api/v0/product/${text}.json`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 1 && data.product) {
            const p = data.product;
            const nutris = p.nutriments || {};

            // OFF provides per 100g, but sometimes per serving
            // We'll try to use serving values if available, otherwise 100g
            setFoodInputs({
              name: p.product_name || `Scanned Item (${text.substring(0, 6)})`,
              calories: String(Math.round(nutris['energy-kcal_serving'] || nutris['energy-kcal_100g'] || 0)),
              protein: String(Math.round(nutris['proteins_serving'] || nutris['proteins_100g'] || 0)),
              carbs: String(Math.round(nutris['carbohydrates_serving'] || nutris['carbohydrates_100g'] || 0)),
              fat: String(Math.round(nutris['fat_serving'] || nutris['fat_100g'] || 0)),
              sugar: String(Math.round(nutris['sugars_serving'] || nutris['sugars_100g'] || 0)),
              sodium: String(Math.round((nutris['sodium_serving'] || nutris['sodium_100g'] || 0) * 1000)), // OFF is in g, we need mg
              fiber: String(Math.round(nutris['fiber_serving'] || nutris['fiber_100g'] || 0)),
              mealCategory: foodInputs.mealCategory
            });
            showToast(`Loaded: ${p.product_name || 'Unknown product'}`, "success");
            setError(`Successfully loaded: ${p.product_name || 'Unknown product'}`);
            setTimeout(() => setError(null), 3000);
          } else {
            showToast("Product not found", "error");
            setError(`Product not found in Open Food Facts database (Barcode: ${text})`);
          }
        })
        .catch(err => {
          console.error("Barcode API Error:", err);
          showToast("Failed to fetch data", "error");
          setError("Failed to fetch product data. Please check your connection.");
        })
        .finally(() => {
          setAiLoading(false);
        });
    },
    paused: !isScanning,
  });

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Fetch initial data
  useEffect(() => {
    if (authLoading) return;

    // Check if URL has ?add=true and open modal
    if (window.location.search.includes('add=true')) {
      setIsAddModalOpen(true);
      window.history.replaceState({}, '', '/');
    }

    const handleOpenModal = () => setIsAddModalOpen(true);
    window.addEventListener('openAddFoodModal', handleOpenModal);

    async function fetchData() {
      try {
        const now = new Date();
        const start = startOfDay(now).toISOString();
        const end = endOfDay(now).toISOString();

        const [goalsRes, foodsRes, userRes, waterRes, allFoodsRes] = await Promise.all([
          fetch(`${API_BASE}/goals`),
          fetch(`${API_BASE}/foods?start=${start}&end=${end}`),
          fetch(`${API_BASE}/user`),
          fetch(`${API_BASE}/water?date=${startOfDay(now).toISOString().split('T')[0]}`),
          fetch(`${API_BASE}/foods`)
        ]);

        if (goalsRes.ok) {
          const g = await goalsRes.json();
          const newGoals = {
            calories: g.calories || 2000,
            protein: g.protein || 150,
            carbs: g.carbs || 250,
            fat: g.fat || 70,
            sugar: g.sugar || 50,
            sodium: g.sodium || 2000,
            fiber: g.fiber || 30
          };
          setGoals(newGoals);
        }

        if (userRes.ok) {
          const u = await userRes.json();
          const newUser = {
            name: u.name || "User",
            age: u.age || 25,
            weight: u.weight || 70,
            height: u.height || 170,
            sex: u.sex || "other"
          };
          setUser(newUser);
        }

        if (foodsRes.ok) {
          const f = await foodsRes.json();
          setFoods(f || []);
        }

        if (waterRes.ok) {
          const w = await waterRes.json();
          setWaterGlasses(w.glasses || 0);
        }

        if (allFoodsRes.ok) {
          const allF = await allFoodsRes.json();
          if (Array.isArray(allF)) {
            const uniqueNames = new Set();
            const recent = [];
            for (const f of allF) {
              if (!uniqueNames.has(f.name)) {
                uniqueNames.add(f.name);
                recent.push(f);
                if (recent.length >= 5) break;
              }
            }
            setRecentFoods(recent);
          }
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
        setError("Failed to reach the server. Make sure the Go backend is running and MongoDB is connected.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    return () => {
      window.removeEventListener('openAddFoodModal', handleOpenModal);
    };
  }, [authLoading]);

  // Handlers
  const handleUpdateWater = async (increment: number) => {
    const newGlasses = Math.max(0, waterGlasses + increment);
    setWaterGlasses(newGlasses);
    if (increment > 0) showToast(`Added water! (${newGlasses} glasses)`, "success");
    try {
      await fetch(`${API_BASE}/water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: startOfDay(new Date()).toISOString().split('T')[0],
          glasses: newGlasses
        })
      });
    } catch (err) {
      console.error(err);
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
          mealCategory: editInputs.mealCategory
        })
      });

      if (res.ok) {
        const updatedFood = await res.json();
        setFoods(foods.map(f => f.id === updatedFood.id ? updatedFood : f));
        setRecentFoods(prev => prev.map(f => f.name === editingFood.name ? { ...f, name: updatedFood.name } : f));
        setEditingFood(null);
        showToast("Entry updated!", "success");
      }
    } catch (err) {
      console.error(err);
    }
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
          mealCategory: foodInputs.mealCategory
        })
      });

      if (res.ok) {
        const newFood = await res.json();
        setFoods([newFood, ...foods]); // Add to top matching our DB sort
        setFoodInputs({ name: "", calories: "", protein: "", carbs: "", fat: "", sugar: "", sodium: "", fiber: "", mealCategory: "Breakfast" });
        showToast(`Added ${name}!`, "success");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFood = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/foods/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setFoods(foods.filter(f => f.id !== id));
        showToast("Entry deleted", "info");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickAdd = async (food: any) => {
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  const parseAiResponse = (content: string) => {
    const foodDataRegex = /\[FOOD_DATA:\s*({.*?})\]/g;
    const foods: any[] = [];
    const cleanContent = content.replace(foodDataRegex, (m, json) => {
      try {
        foods.push(JSON.parse(json));
      } catch { }
      return "";
    }).trim();
    return { cleanContent, foods };
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

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

  const handleGetAiAdvice = async () => {
    setAiLoading(true);
    setAiAdvice(null);
    setError(null);

    const summary = `วันนี้กินไป: ${calTotal} kcal, P: ${proTotal}g, F: ${fatTotal}g. เป้าหมาย: ${goals.calories} kcal, P: ${goals.protein}g.`;

    try {
      const res = await fetch(`${API_BASE}/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || aiLoading) return;

    const userMsg = { role: 'user' as const, content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setAiLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatMessages, userMsg] }),
      });

      if (res.ok) {
        const reply = await res.text();
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setError("Chat service unavailable");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to reach AI Chat");
    } finally {
      setAiLoading(false);
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
  const fatTotal = Math.round(totals.fat * 10) / 10;
  const calRemaining = Math.max(0, goals.calories - calTotal);
  const proRemaining = Math.max(0, Math.round((goals.protein - proTotal) * 10) / 10);
  const fatRemaining = Math.max(0, Math.round((goals.fat - fatTotal) * 10) / 10);

  // Ring Calculation
  const radius = 70;
  const circumference = radius * 2 * Math.PI;
  const calPercent = Math.min(100, Math.max(0, (calTotal / goals.calories) * 100));
  const calOffset = circumference - (calPercent / 100) * circumference;
  const isOverCal = calTotal > goals.calories;

  // Bar Calculations
  const proPercent = Math.min(100, Math.max(0, (proTotal / goals.protein) * 100));
  const fatPercent = Math.min(100, Math.max(0, (fatTotal / goals.fat) * 100));

  const isGoalPro = proTotal >= goals.protein;
  const isGoalFat = fatTotal >= goals.fat;

  return (
    <div className="app-container">
      {error && (
        <div style={{ background: "var(--danger)", padding: "12px", borderRadius: "12px", fontSize: "14px", color: "white" }}>
          {error}
        </div>
      )}

      <header className="glass-panel main-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', width: '40px', height: '40px', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
            <Image
              src="/logo.png"
              alt="SomDun Logo"
              fill
              style={{ objectFit: 'contain', padding: '2px' }}
            />
          </div>
          <div>
            <h1>SomDun</h1>
            <p className="date-display">{currentDate}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
            className="icon-btn"
            style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '40px' }}
            title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
          >
            {language === 'en' ? 'TH' : 'EN'}
          </button>


          <Link href="/dashboard" className="icon-btn" title={t('analyticsTitle')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </Link>
          <button onClick={logout} className="icon-btn" title={t('logout')} style={{ color: "var(--danger)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
          <Link href="/profile" className="icon-btn" title={t('profileSettings')}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </Link>
        </div>
      </header>

      <div className="responsive-layout">
        <div className="layout-column">
          {/* Goals Dashboard */}
          <section className="dashboard">
            {/* Calories Card */}
            <div className="glass-panel cal-card">
              <h2>Calories</h2>
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
                    color: 'var(--danger)'
                  } : {
                    background: 'var(--accent-cal-gradient)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>
                    {calTotal}
                  </span>
                  <span className="label">/ {goals.calories} kcal</span>
                </div>
              </div>
              <div className="cal-stats">
                <div className="stat">
                  <span className="stat-value">{isOverCal ? calTotal - goals.calories : calRemaining}</span>
                  <span className="stat-label" style={isOverCal ? { color: 'var(--danger)' } : {}}>
                    {isOverCal ? t('over') : t('remaining')}
                  </span>
                </div>
              </div>
            </div>

            {/* Macros Progress */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Protein Bar */}
              <div className="pro-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                <div className="pro-header">
                  <h2 style={{ fontSize: '16px' }}>Protein</h2>
                  <div className="pro-values">
                    <span className="consumed">{proTotal}</span>
                    <span className="label">/ {goals.protein}g</span>
                  </div>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${proPercent}%`,
                      background: isGoalPro ? 'var(--success)' : 'var(--accent-pro-gradient)',
                      boxShadow: isGoalPro ? '0 0 10px rgba(46, 160, 67, 0.4)' : '0 0 10px rgba(0, 210, 255, 0.4)'
                    }}
                  ></div>
                </div>
                <p className="pro-remaining"><span>{proRemaining}</span>g left</p>
              </div>



              {/* Fat Bar */}
              <div className="pro-card" style={{ background: 'none', border: 'none', padding: 0 }}>
                <div className="pro-header">
                  <h2 style={{ fontSize: '16px' }}>Fat</h2>
                  <div className="pro-values">
                    <span className="consumed" style={{ background: 'var(--accent-fat-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{fatTotal}</span>
                    <span className="label">/ {goals.fat}g</span>
                  </div>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${fatPercent}%`,
                      background: 'var(--accent-fat-gradient)',
                      boxShadow: '0 0 10px rgba(191, 90, 242, 0.4)'
                    }}
                  ></div>
                </div>
                <p className="pro-remaining"><span>{fatRemaining}</span>g left</p>
              </div>




            </div>
          </section>
        </div>

        <div className="layout-column">
          {/* AI Assistant Insight */}
          <section className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: aiAdvice ? '16px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="icon-btn" style={{ background: 'var(--accent-cal-gradient)', border: 'none', width: '40px', height: '40px', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 12L2.7 16.5"></path></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>AI Nutrition Guru</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Personalized insights</p>
                </div>
              </div>
              <button
                onClick={handleGetAiAdvice}
                className="primary-btn"
                disabled={aiLoading}
                style={{ margin: 0, padding: '0 16px', fontSize: '13px', borderRadius: '12px', flexShrink: 0, height: '40px' }}
              >
                {aiLoading ? 'Thinking...' : 'Get Advice'}
              </button>
            </div>
            {aiAdvice && (
              <div style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', borderLeft: '4px solid var(--accent-cal)', marginTop: '16px' }}>
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiAdvice}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </section>

          {/* Water Tracker */}
          <section className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600 }}>
                  <span style={{ color: '#00d2ff', fontSize: '18px' }}>💧</span> Daily Water
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {waterGlasses} / 8 glasses
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => handleUpdateWater(-1)} className="icon-btn" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>-</button>
                <button onClick={() => handleUpdateWater(1)} className="icon-btn" style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0, 210, 255, 0.2)', color: '#00d2ff', border: '1px solid rgba(0, 210, 255, 0.3)' }}>+</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', height: '24px', width: '100%' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: '6px',
                    background: i < waterGlasses ? '#00d2ff' : 'rgba(255,255,255,0.05)',
                    transition: 'background 0.3s ease, box-shadow 0.3s ease',
                    boxShadow: i < waterGlasses ? '0 0 12px rgba(0,210,255,0.4)' : 'none'
                  }}
                ></div>
              ))}
            </div>
          </section>

          {/* Desktop Add Button */}
          <div className="desktop-only" style={{ marginBottom: '20px' }}>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="primary-btn"
              style={{ width: '100%', padding: '14px', fontSize: '16px', margin: 0, boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}
            >
              + {t('addFood')}
            </button>
          </div>

          {/* Recent Foods */}
          {recentFoods.length > 0 && (
            <section className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-secondary)' }}>Recent Foods</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recentFoods.map((f, i) => (
                  <button key={i} onClick={() => handleQuickAdd(f)} className="primary-btn outline" style={{ padding: '6px 12px', fontSize: '12px', margin: 0 }}>
                    + {f.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Today's Foods */}
          <section className="foods-list-section">
            <h3 className="section-title">Today's Intake</h3>
            <div className="foods-list">
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} className="food-item skeleton" style={{ height: '72px', border: 'none' }}></div>
                  ))}
                </div>
              ) : foods.length === 0 ? (
                <div className="food-item" style={{ justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                  No foods added yet today. Let&apos;s eat!
                </div>
              ) : (
                ['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(category => {
                  const categoryFoods = foods.filter(f => (f.mealCategory || 'Breakfast') === category);
                  if (categoryFoods.length === 0) return null;

                  return (
                    <div key={category} style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>{category}</h4>
                      {categoryFoods.map(food => (
                        <div key={food.id} className="food-item">
                          <div className="food-info">
                            <h4>{food.name}</h4>
                            <div className="food-stats" style={{ flexWrap: 'wrap', rowGap: '4px' }}>
                              <span><strong className="c-label">{food.calories}</strong> kcal</span>
                              <span><strong className="p-label" style={{ color: 'var(--accent-pro)' }}>{food.protein}</strong>g P</span>
                              <span><strong style={{ color: 'var(--accent-fat)' }}>{(food.fat || 0)}</strong>g F</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="icon-btn" onClick={() => openEditModal(food)} title="Edit" style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.05)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button className="delete-btn" onClick={() => handleDeleteFood(food.id)} title="Delete" style={{ width: '32px', height: '32px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Add Food Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Add Entry</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="icon-btn">&times;</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  onClick={() => setIsScanning(!isScanning)}
                  className="primary-btn outline"
                  style={{ flex: 1, margin: 0, padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
                  {isScanning ? 'Stop Scan' : 'Scan'}
                </button>

                <div style={{ flex: 1, position: 'relative' }}>
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
                    style={{ width: '100%', margin: 0, padding: '8px 12px', fontSize: '13px', background: 'var(--accent-pro-gradient)', color: 'white', display: 'flex', justifyContent: 'center' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                    {aiLoading ? 'Scanning...' : 'AI Scan'}
                  </label>
                </div>
              </div>
            </div>

            {isScanning && (
              <div style={{ marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--panel-border)', background: '#000', display: 'flex', justifyContent: 'center' }}>
                <video ref={zxingRef} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} />
              </div>
            )}

            <form id="add-food-form" onSubmit={(e) => { handleAddFood(e); setIsAddModalOpen(false); }}>
              <div className="input-group">
                <input
                  type="text"
                  required
                  placeholder="What did you eat?"
                  value={foodInputs.name}
                  onChange={e => setFoodInputs({ ...foodInputs, name: e.target.value })}
                />
              </div>
              <div className="input-row" style={{ marginTop: '12px' }}>
                <div className="input-group">
                  <select
                    value={foodInputs.mealCategory}
                    onChange={e => setFoodInputs({ ...foodInputs, mealCategory: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Breakfast">🍳 Breakfast</option>
                    <option value="Lunch">🥗 Lunch</option>
                    <option value="Dinner">🍲 Dinner</option>
                    <option value="Snack">🍪 Snack</option>
                  </select>
                </div>
                <div className="input-group">
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Calories"
                    value={foodInputs.calories}
                    onChange={e => setFoodInputs({ ...foodInputs, calories: e.target.value })}
                  />
                </div>
              </div>
              <div className="input-row" style={{ marginTop: '12px', marginBottom: '16px' }}>
                <div className="input-group">
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    placeholder="Protein (g)"
                    value={foodInputs.protein}
                    onChange={e => setFoodInputs({ ...foodInputs, protein: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Fat (g)"
                    value={foodInputs.fat}
                    onChange={e => setFoodInputs({ ...foodInputs, fat: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="primary-btn" disabled={loading} style={{ marginTop: '16px', width: '100%' }}>
                <span>Add Food</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Food Modal */}
      {editingFood && (
        <div className="modal-overlay" onClick={() => setEditingFood(null)}>
          <div className="glass-panel modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Edit Entry</h3>
              <button onClick={() => setEditingFood(null)} className="icon-btn">&times;</button>
            </div>
            <form onSubmit={handleEditFoodSubmit}>
              <div className="input-group" style={{ marginBottom: '12px' }}>
                <input type="text" required placeholder="What did you eat?" value={editInputs.name} onChange={e => setEditInputs({ ...editInputs, name: e.target.value })} />
              </div>
              <div className="input-row" style={{ marginBottom: '12px' }}>
                <div className="input-group">
                  <select
                    value={editInputs.mealCategory}
                    onChange={e => setEditInputs({ ...editInputs, mealCategory: e.target.value })}
                    style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--panel-border)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="Breakfast">🍳 Breakfast</option>
                    <option value="Lunch">🥗 Lunch</option>
                    <option value="Dinner">🍲 Dinner</option>
                    <option value="Snack">🍪 Snack</option>
                  </select>
                </div>
                <div className="input-group">
                  <input type="number" required min="0" placeholder="Calories" value={editInputs.calories} onChange={e => setEditInputs({ ...editInputs, calories: e.target.value })} />
                </div>
              </div>
              <div className="input-row" style={{ marginBottom: '24px' }}>
                <div className="input-group">
                  <input type="number" required min="0" step="0.1" placeholder="Protein (g)" value={editInputs.protein} onChange={e => setEditInputs({ ...editInputs, protein: e.target.value })} />
                </div>
                <div className="input-group">
                  <input type="number" min="0" step="0.1" placeholder="Fat (g)" value={editInputs.fat} onChange={e => setEditInputs({ ...editInputs, fat: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="primary-btn" style={{ width: '100%' }}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {/* Floating AI Chat Bubble */}
      <div className={`chat-widget ${isChatOpen ? 'open' : ''}`}>
        {isChatOpen && (
          <div className="chat-window glass-panel">
            <div className="chat-header">
              <h3>AI Personal Assistant</h3>
              <button onClick={() => setIsChatOpen(false)} className="close-btn">&times;</button>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <div className="msg-placeholder">สวัสดีครับ! มีอะไรให้ช่วยเรื่องโภชนาการไหมครับ?</div>
              )}
              {chatMessages.map((m, i) => {
                const { cleanContent, foods: detectedFoods } = parseAiResponse(m.content);
                return (
                  <div key={i} className={`message ${m.role}`}>
                    <div className="msg-bubble">
                      <div className="markdown-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanContent}
                        </ReactMarkdown>
                      </div>
                      {detectedFoods.length > 0 && m.role === 'assistant' && (
                        <div className="detected-foods" style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {detectedFoods.map((f, fi) => (
                            <button
                              key={fi}
                              onClick={() => handleQuickAdd(f)}
                              className="primary-btn"
                              style={{ padding: '6px 12px', fontSize: '11px', margin: 0, justifyContent: 'center' }}
                            >
                              + เพิ่ม {f.name} ({f.calories} kcal)
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {aiLoading && <div className="message assistant"><div className="msg-bubble loading-dots">...</div></div>}
            </div>
            <form className="chat-input-area" onSubmit={handleSendMessage}>
              <input
                type="text"
                placeholder="พิมพ์ข้อความ..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                autoFocus
              />
              <button type="submit" disabled={aiLoading}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </div>
        )}
        <button className="chat-toggle-btn" onClick={() => setIsChatOpen(!isChatOpen)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
