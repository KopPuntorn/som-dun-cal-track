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

const RARITY_THEMES: Record<string, { gradient: string; glow: string; label: string; emoji: string; primary: string }> = {
  diamond: {
    gradient: "linear-gradient(135deg, #0ff5f5, #00b4d8, #7b2ff7)",
    glow: "0 0 28px rgba(0, 255, 255, 0.55), 0 0 60px rgba(0, 255, 255, 0.15)",
    label: "DIAMOND",
    emoji: "💎",
    primary: "#0ff5f5",
  },
  gold: {
    gradient: "linear-gradient(135deg, #ffd700, #ff8c00, #ff6b00)",
    glow: "0 0 28px rgba(255, 215, 0, 0.55), 0 0 60px rgba(255, 165, 0, 0.15)",
    label: "GOLD",
    emoji: "🥇",
    primary: "#ffd700",
  },
  emerald: {
    gradient: "linear-gradient(135deg, #10b981, #059669, #34d399)",
    glow: "0 0 28px rgba(16, 185, 129, 0.55), 0 0 60px rgba(16, 185, 129, 0.15)",
    label: "EMERALD",
    emoji: "💚",
    primary: "#10b981",
  },
  silver: {
    gradient: "linear-gradient(135deg, #94a3b8, #64748b, #cbd5e1)",
    glow: "0 0 20px rgba(148, 163, 184, 0.4), 0 0 40px rgba(148, 163, 184, 0.1)",
    label: "SILVER",
    emoji: "🔘",
    primary: "#cbd5e1",
  },
  bronze: {
    gradient: "linear-gradient(135deg, #b45309, #92400e, #d97706)",
    glow: "0 0 20px rgba(180, 83, 9, 0.4), 0 0 40px rgba(180, 83, 9, 0.1)",
    label: "BRONZE",
    emoji: "🔶",
    primary: "#d97706",
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
                className="icon-btn mobile-hidden"
                style={{ fontSize: '14px', fontWeight: 'bold', minWidth: '40px' }}
                title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
              >
                {language === 'en' ? 'TH' : 'EN'}
              </button>
              <button
                onClick={handleShare}
                disabled={!card || isSharing}
                className="icon-btn mobile-hidden"
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
            <TiltCard maxTilt={10} intensity={280} glareOpacity={0.2}>
              <div ref={cardRef} className="player-card-wrapper">

                {/* Animated spinning border */}
                <div className={`card-spin-border card-spin-border--${card.rarity}`} />

                {/* Card face */}
                <div className="player-card-main">
                  {/* Texture overlays */}
                  <div className="card-scanlines" />
                  <div className="card-grid-dots" />
                  <div className="player-card-shimmer" />
                  {card.rarity === "diamond" && <div className="diamond-shimmer" />}

                  {/* Corner brackets */}
                  <div className="card-corner card-corner--tl" style={{ borderColor: theme.primary }} />
                  <div className="card-corner card-corner--tr" style={{ borderColor: theme.primary }} />
                  <div className="card-corner card-corner--bl" style={{ borderColor: theme.primary }} />
                  <div className="card-corner card-corner--br" style={{ borderColor: theme.primary }} />

                  {/* Rarity Banner */}
                  <div className="card-rarity-banner">
                    <span
                      className="card-rarity-tag"
                      style={{
                        backgroundImage: theme.gradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {theme.emoji} {t(`rarity${card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}` as TranslationKeys)}
                    </span>
                    <span className="card-position-tag">{card.position}</span>
                  </div>

                  {/* Hero Row: OVR | Avatar | Days */}
                  <div className="card-hero-row">
                    {/* OVR */}
                    <div className="card-ovr-block">
                      <div
                        className="card-ovr-num"
                        style={{
                          backgroundImage: theme.gradient,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          filter: `drop-shadow(0 0 12px ${theme.primary}80)`,
                        }}
                      >
                        {card.ovr}
                      </div>
                      <div className="card-ovr-label">OVR</div>
                    </div>

                    {/* Avatar */}
                    <div className="card-avatar-wrap">
                      <div
                        className="card-avatar"
                        style={{ boxShadow: theme.glow }}
                      >
                        {card.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="card-player-name">{card.name}</div>
                    </div>

                    {/* Days Tracked */}
                    <div className="card-days-block">
                      <div className="card-days-num">{card.daysTracked}</div>
                      <div className="card-days-label">{language === "en" ? "DAYS" : "วัน"}</div>
                    </div>
                  </div>

                  {/* Radar Chart */}
                  <div className="player-radar">
                    <svg width="180" height="180" viewBox="0 0 220 220">
                      <defs>
                        <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
                          <stop offset="100%" stopColor={theme.primary} stopOpacity="0.06" />
                        </linearGradient>
                        <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={theme.primary} stopOpacity="0.9" />
                          <stop offset="100%" stopColor={theme.primary} stopOpacity="0.4" />
                        </linearGradient>
                        <filter id="radarGlow">
                          <feGaussianBlur stdDeviation="2" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>

                      {/* Grid rings */}
                      {[0.33, 0.66, 1].map((scale, i) => (
                        <polygon
                          key={i}
                          points={radarPoints(
                            { nut: 99 * scale, hyd: 99 * scale, fit: 99 * scale, rec: 99 * scale, dis: 99 * scale, end: 99 * scale } as CardData["stats"],
                            110, 110, 70
                          )}
                          fill="none"
                          stroke={i === 2 ? `${theme.primary}18` : "rgba(255,255,255,0.04)"}
                          strokeWidth={i === 2 ? "1.5" : "1"}
                        />
                      ))}

                      {/* Axis lines */}
                      {radarLabelPositions(110, 110, 70).map(({ x, y }, i) => (
                        <line
                          key={i}
                          x1="110" y1="110"
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
                        filter="url(#radarGlow)"
                      />

                      {/* Labels */}
                      {radarLabelPositions(110, 110, 70).map(({ key, x, y }) => (
                        <text
                          key={key}
                          x={x} y={y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={`${theme.primary}80`}
                          fontSize="9"
                          fontWeight="800"
                          letterSpacing="1.5"
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
                            <circle key={key} cx={x} cy={y} r="3" fill={theme.primary} opacity="0.9"
                              style={{ filter: `drop-shadow(0 0 4px ${theme.primary})` }} />
                          );
                        });
                      })()}
                    </svg>
                  </div>

                  {/* Horizontal Stat Bars */}
                  <div className="card-stat-bars">
                    {(Object.keys(STAT_LABELS) as Array<keyof CardData["stats"]>).map((key) => {
                      const val = card.stats[key];
                      return (
                        <div key={key} className="card-stat-bar-row">
                          <span className="card-bar-label">{STAT_LABELS[key]}</span>
                          <div className="card-bar-track">
                            <div
                              className="card-bar-fill"
                              style={{
                                width: `${(val / 99) * 100}%`,
                                background: theme.gradient,
                                boxShadow: `0 0 8px ${theme.primary}60`,
                              }}
                            />
                          </div>
                          <span className="card-bar-value">{val}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="card-footer-bar">
                    <span className="card-footer-brand">SOMDUN</span>
                    <span className="card-footer-month">{monthLabel.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </TiltCard>

            {/* Breakdown Panel */}
            <div className="glass-panel breakdown-section">
              <div className="breakdown-title">{t("breakdown")}</div>
              {(Object.keys(STAT_LABELS) as Array<keyof CardData["stats"]>).map((key) => {
                const val = card.stats[key];
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
                            boxShadow: `0 0 8px ${theme.primary}50`,
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
