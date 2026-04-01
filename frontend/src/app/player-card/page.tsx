"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { TranslationKeys } from "@/translations";
import TiltCard from "@/components/TiltCard";
import LoadingSkeleton, { SkeletonPlayerCard } from "@/components/LoadingSkeleton";
import PageHeader from "@/components/PageHeader";

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

type CardData = {
  name: string;
  month: string;
  ovr: number;
  rarity: string;
  stats: {
    nut: number;
    hyd: number;
    fit: number;
    rec: number;
    dis: number;
    end: number;
  };
  position: string;
  daysInMonth: number;
  daysTracked: number;
};

const RARITY_THEMES: Record<string, { gradient: string; glow: string; label: string; emoji: string }> = {
  diamond: {
    gradient: "linear-gradient(135deg, #0ff5f5, #00b4d8, #7b2ff7)",
    glow: "0 0 60px rgba(0, 255, 255, 0.4), 0 0 120px rgba(0, 255, 255, 0.1)",
    label: "DIAMOND",
    emoji: "💎",
  },
  gold: {
    gradient: "linear-gradient(135deg, #ffd700, #ff8c00, #ff6b00)",
    glow: "0 0 60px rgba(255, 215, 0, 0.4), 0 0 120px rgba(255, 165, 0, 0.1)",
    label: "GOLD",
    emoji: "🟡",
  },
  emerald: {
    gradient: "linear-gradient(135deg, #10b981, #059669, #34d399)",
    glow: "0 0 60px rgba(16, 185, 129, 0.4), 0 0 120px rgba(16, 185, 129, 0.1)",
    label: "EMERALD",
    emoji: "🟢",
  },
  silver: {
    gradient: "linear-gradient(135deg, #94a3b8, #64748b, #cbd5e1)",
    glow: "0 0 60px rgba(148, 163, 184, 0.3), 0 0 120px rgba(148, 163, 184, 0.1)",
    label: "SILVER",
    emoji: "🔵",
  },
  bronze: {
    gradient: "linear-gradient(135deg, #b45309, #92400e, #d97706)",
    glow: "0 0 60px rgba(180, 83, 9, 0.3), 0 0 120px rgba(180, 83, 9, 0.1)",
    label: "BRONZE",
    emoji: "⚪",
  },
};

const STAT_LABELS: Record<string, string> = {
  nut: "NUT",
  hyd: "HYD",
  fit: "FIT",
  rec: "REC",
  dis: "DIS",
  end: "END",
};

const STAT_FULL_LABELS: Record<string, string> = {
  nut: "Nutrition",
  hyd: "Hydration",
  fit: "Fitness",
  rec: "Recovery",
  dis: "Discipline",
  end: "Endurance",
};

// Build hexagonal radar chart points
function radarPoints(stats: CardData["stats"], cx: number, cy: number, r: number): string {
  const keys = ["nut", "hyd", "fit", "rec", "dis", "end"] as const;
  const angleStep = (Math.PI * 2) / keys.length;
  const startAngle = -Math.PI / 2;

  return keys
    .map((key, i) => {
      const val = stats[key] / 99;
      const angle = startAngle + angleStep * i;
      const x = cx + Math.cos(angle) * r * val;
      const y = cy + Math.sin(angle) * r * val;
      return `${x},${y}`;
    })
    .join(" ");
}

function radarLabelPositions(cx: number, cy: number, r: number) {
  const keys = ["nut", "hyd", "fit", "rec", "dis", "end"] as const;
  const angleStep = (Math.PI * 2) / keys.length;
  const startAngle = -Math.PI / 2;

  return keys.map((key, i) => {
    const angle = startAngle + angleStep * i;
    const x = cx + Math.cos(angle) * (r + 22);
    const y = cy + Math.sin(angle) * (r + 22);
    return { key, x, y };
  });
}

export default function PlayerCardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isSharing, setIsSharing] = useState(false);

  const { data: cardData, error: cardError, isLoading: cardLoading } = useSWR(
    authLoading ? null : `${API_BASE}/player-card?month=${selectedMonth}`,
    fetcher
  );

  useEffect(() => {
    if (cardData) {
      setCard(cardData);
      setLoading(false);
    }
    if (cardError) {
      setLoading(false);
    }
  }, [cardData, cardError]);

  // Gamification Logic (Synced with Backend)
  const totalXP = user?.xp || 0;
  const level = user?.level || 1;
  const currentLevelXP = totalXP % 1000;
  const xpProgress = (currentLevelXP / 1000) * 100;

  const handleShare = async () => {
    if (!cardRef.current) return;
    setIsSharing(true);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#050505",
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const file = new File([blob], `player-card-${selectedMonth}.png`, { type: "image/png" });
        const shareData = {
          files: [file],
          title: t("shareTitleTemplate").replace("{month}", monthLabel),
          text: t("shareTextTemplate").replace("{ovr}", String(card?.ovr || 0)),
        };

        // Try native share if available and supported for this data
        if (navigator.share && navigator.canShare?.(shareData)) {
          try {
            await navigator.share(shareData);
          } catch {
            // Fallback to download
            downloadImage(blob);
          }
        } else {
          downloadImage(blob);
        }

        setIsSharing(false);
      }, "image/png");
    } catch (err) {
      console.error("Share failed", err);
      setIsSharing(false);
    }
  };

  const downloadImage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `player-card-${selectedMonth}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const theme = RARITY_THEMES[card?.rarity || "bronze"];
  const monthLabel = card
    ? new Date(card.month + "-01").toLocaleDateString(language === "en" ? "en-US" : "th-TH", { month: "long", year: "numeric" })
    : "";

  // Month navigation
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newMonth);
  };

  if (authLoading) {
    return (
      <div className="page-shell page-shell--center">
        <div className="floating-blob floating-blob-1" />
        <div className="floating-blob floating-blob-2" />
        <div className="floating-blob floating-blob-3" />
        <div className="app-container" style={{ maxWidth: "600px" }}>
          <PageHeader
            title={t("playerCard")}
            backHref="/"
            backLabel={t("back")}
          />
          <SkeletonPlayerCard />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="floating-blob floating-blob-1" />
      <div className="floating-blob floating-blob-2" />
      <div className="floating-blob floating-blob-3" />
      <div className="app-container perspective-1000" style={{ maxWidth: "600px", alignItems: "center" }}>
        {/* Header */}
        <PageHeader
          title={t("playerCard")}
          backHref="/"
          backLabel={t("back")}
          actions={
            <>
              <button
                onClick={() => setLanguage(language === 'en' ? 'th' : 'en')}
                className="icon-btn"
                style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '40px' }}
                title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
              >
                {language === 'en' ? 'TH' : 'EN'}
              </button>
              <button
                onClick={handleShare}
                disabled={!card || isSharing}
                className="icon-btn"
                title={t("shareCard")}
                style={{ display: card ? "flex" : "none" }}
              >
                {isSharing ? (
                  <div className="loading-dots" style={{ fontSize: "12px" }}>...</div>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" y2="15"></line>
                  </svg>
                )}
              </button>
            </>
          }
        />

        {/* Month Selector */}
        <div className="glass-panel month-selector">
          <button onClick={() => changeMonth(-1)} className="glass-btn month-selector-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <span className="month-selector-label">
            {monthLabel || selectedMonth}
          </span>
          <button onClick={() => changeMonth(1)} className="glass-btn month-selector-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"></polyline></svg>
          </button>
        </div>

        {loading ? (
          <SkeletonPlayerCard />
        ) : card ? (
          <div className="player-card-container">
            {/* ═══ THE CARD ═══ */}
            <TiltCard maxTilt={12} intensity={300} glareOpacity={0.25}>
              <div ref={cardRef} className="player-card-wrapper">
                <div
                  className="player-card-main depth-card-3d"
                  style={{
                    border: `2px solid`,
                    borderImageSlice: 1,
                    borderImageSource: theme.gradient,
                    boxShadow: theme.glow,
                  }}
                >
                  {/* Rarity shimmer overlay */}
                  <div className="player-card-shimmer" />
                  {card.rarity === 'diamond' && <div className="diamond-shimmer" />}

                  {/* Top Section: OVR + Name + Position */}
                  <div className="player-card-header preserve-3d depth-60">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      {/* OVR Badge */}
                      <div className="player-ovr">
                        <div
                          className="player-ovr-value"
                          style={{
                            backgroundImage: theme.gradient,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          {card.ovr}
                        </div>
                        <div className="player-ovr-label">OVR</div>
                      </div>

                      {/* Position Badge */}
                      <div className="player-position">{card.position}</div>
                    </div>

                    {/* Player Name */}
                    <div className="player-name">{card.name}</div>

                    {/* Rarity Label */}
                    <div
                      className="player-rarity"
                      style={{
                        backgroundImage: theme.gradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {theme.emoji} {t(`rarity${card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}` as TranslationKeys)}
                    </div>
                  </div>

                  {/* Radar Chart */}
                  <div className="player-radar preserve-3d depth-40">
                    <svg width="200" height="200" viewBox="0 0 220 220">
                      {/* Grid rings */}
                      {[0.33, 0.66, 1].map((scale, i) => (
                        <polygon
                          key={i}
                          points={radarPoints(
                            { nut: 99 * scale, hyd: 99 * scale, fit: 99 * scale, rec: 99 * scale, dis: 99 * scale, end: 99 * scale } as CardData["stats"],
                            110, 110, 70
                          )}
                          fill="none"
                          stroke="rgba(255,255,255,0.06)"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Axis lines */}
                      {radarLabelPositions(110, 110, 70).map(({ x, y }, i) => (
                        <line
                          key={i}
                          x1="110"
                          y1="110"
                          x2={110 + (x - 110) * (70 / (70 + 22))}
                          y2={110 + (y - 110) * (70 / (70 + 22))}
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Data polygon */}
                      <polygon
                        points={radarPoints(card.stats, 110, 110, 70)}
                        fill="url(#radarGrad)"
                        stroke="url(#radarStroke)"
                        strokeWidth="2"
                        opacity="0.85"
                      />

                      {/* Gradient defs */}
                      <defs>
                        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={card.rarity === "diamond" ? "#0ff5f5" : card.rarity === "gold" ? "#ffd700" : "#10b981"} stopOpacity="0.25" />
                          <stop offset="100%" stopColor={card.rarity === "diamond" ? "#7b2ff7" : card.rarity === "gold" ? "#ff6b00" : "#059669"} stopOpacity="0.1" />
                        </linearGradient>
                        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={card.rarity === "diamond" ? "#0ff5f5" : card.rarity === "gold" ? "#ffd700" : "#10b981"} />
                          <stop offset="100%" stopColor={card.rarity === "diamond" ? "#7b2ff7" : card.rarity === "gold" ? "#ff6b00" : "#059669"} />
                        </linearGradient>
                      </defs>

                      {/* Labels */}
                      {radarLabelPositions(110, 110, 70).map(({ key, x, y }) => (
                        <text
                          key={key}
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="var(--text-secondary)"
                          fontSize="10"
                          fontWeight="700"
                          letterSpacing="1"
                        >
                          {STAT_LABELS[key]}
                        </text>
                      ))}

                      {/* Data point dots */}
                      {(() => {
                        const keys = ["nut", "hyd", "fit", "rec", "dis", "end"] as const;
                        const angleStep = (Math.PI * 2) / keys.length;
                        const startAngle = -Math.PI / 2;
                        return keys.map((key, i) => {
                          const val = card.stats[key] / 99;
                          const angle = startAngle + angleStep * i;
                          const x = 110 + Math.cos(angle) * 70 * val;
                          const y = 110 + Math.sin(angle) * 70 * val;
                          return (
                            <circle key={key} cx={x} cy={y} r="3" fill="white" opacity="0.9" />
                          );
                        });
                      })()}
                    </svg>
                  </div>

                  {/* Stats Grid */}
                  <div className="player-stats-grid preserve-3d depth-20">
                    {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map((key) => {
                      const val = card.stats[key as keyof CardData["stats"]];
                      return (
                        <div key={key} className="player-stat-item">
                          <span
                            className="player-stat-value"
                            style={{
                              backgroundImage: theme.gradient,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            {val}
                          </span>
                          <div>
                            <div className="player-stat-label">{STAT_LABELS[key]}</div>
                            <div className="player-stat-full-label">{t(key as TranslationKeys)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="player-card-footer">
                    <span className="player-card-month">{monthLabel.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Breakdown Stats */}
            <div className="glass-panel breakdown-section">
              <div className="breakdown-title">{t("breakdown")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map((key) => {
                  const val = card.stats[key as keyof CardData["stats"]];
                  return (
                    <div key={key} className="breakdown-item">
                      <div className="breakdown-header">
                        <span className="breakdown-label">{STAT_LABELS[key]}</span>
                        <div className="breakdown-bar-bg">
                          <div
                            className="breakdown-bar"
                            style={{
                              width: `${(val / 99) * 100}%`,
                              background: theme.gradient,
                              boxShadow: `0 0 10px ${card.rarity === 'diamond' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 107, 0, 0.3)'}`,
                            }}
                          />
                        </div>
                        <span className="breakdown-value">{val}</span>
                      </div>
                      <div className="breakdown-desc">{t(`${key}Desc` as TranslationKeys)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ height: "80px" }} />
          </div>
        ) : (
          <div className="player-empty-state">
            <div className="player-empty-icon">🏟️</div>
            <p className="player-empty-text">{t("noDataMonth")}</p>
            <p className="player-empty-subtext">{t("startTrackingPrompt")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
