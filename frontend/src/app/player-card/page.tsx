"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

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
  const { isLoading: authLoading } = useAuth();
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
      <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
        <div className="loading-dots" style={{ fontSize: "24px" }}>{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: "600px", alignItems: "center" }}>
      {/* Header */}
      <header className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "16px 24px", borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => router.push("/")} className="icon-btn" title={t("back")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>
        <h1 style={{ fontSize: "20px", margin: 0, background: 'none', WebkitTextFillColor: 'var(--text-primary)' }}>{t("playerCard")}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
        </div>
      </header>

      {/* Month Selector */}
      <div className="glass-panel" style={{ display: "flex", alignItems: "center", justifyContent: 'center', gap: "24px", margin: "24px 0", padding: '16px 32px', borderRadius: '20px' }}>
        <button onClick={() => changeMonth(-1)} className="glass-btn" style={{ width: "40px", height: "40px", padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "2px", textTransform: "uppercase" }}>
          {monthLabel || selectedMonth}
        </span>
        <button onClick={() => changeMonth(1)} className="glass-btn" style={{ width: "40px", height: "40px", padding: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 6 15 12 9 18"></polyline></svg>
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <div className="loading-dots" style={{ fontSize: "18px" }}>{t("calculatingStats")}</div>
        </div>
      ) : card ? (
        <>
          {/* ═══ THE CARD ═══ */}
          <div ref={cardRef} className="player-card-wrapper" style={{ perspective: "1000px", marginBottom: '32px' }}>
            <div
              className="player-card"
              style={{
                width: "340px",
                minHeight: "520px",
                borderRadius: "24px",
                background: "linear-gradient(160deg, rgba(15,15,20,0.98) 0%, rgba(10,10,15,0.99) 100%)",
                border: `2px solid`,
                borderImageSlice: 1,
                borderImageSource: theme.gradient,
                boxShadow: theme.glow,
                padding: "0",
                position: "relative",
                overflow: "hidden",
                margin: "0 auto",
                transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Rarity shimmer overlay */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.03) 50%, transparent 70%)`,
                pointerEvents: "none",
                zIndex: 0,
              }} />

              {/* Top Section: OVR + Name + Position */}
              <div style={{ padding: "28px 24px 16px", position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  {/* OVR Badge */}
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      fontSize: "48px",
                      fontWeight: 900,
                      lineHeight: 1,
                      background: theme.gradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-2px",
                    }}>
                      {card.ovr}
                    </div>
                    <div style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "3px",
                      color: "var(--text-secondary)",
                      marginTop: "2px",
                    }}>
                      OVR
                    </div>
                  </div>

                  {/* Position Badge */}
                  <div style={{
                    padding: "6px 14px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "14px",
                    fontWeight: 700,
                    letterSpacing: "2px",
                    color: "var(--text-primary)",
                  }}>
                    {card.position}
                  </div>
                </div>

                {/* Player Name */}
                <div style={{
                  marginTop: "12px",
                  fontSize: "28px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                }}>
                  {card.name}
                </div>

                {/* Rarity Label */}
                <div style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "3px",
                  background: theme.gradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginTop: "4px",
                }}>
                  {theme.emoji} {t(`rarity${card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}` as any)}
                </div>
              </div>

              {/* Radar Chart */}
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", position: "relative", zIndex: 1 }}>
                <svg width="220" height="220" viewBox="0 0 220 220">
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
              <div style={{ padding: "8px 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", position: "relative", zIndex: 1 }}>
                {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map((key) => {
                  const val = card.stats[key as keyof CardData["stats"]];
                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "12px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span style={{
                        fontSize: "24px",
                        fontWeight: 800,
                        minWidth: "36px",
                        background: theme.gradient,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}>
                        {val}
                      </span>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-secondary)" }}>{STAT_LABELS[key]}</div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{t(key as any)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{
                padding: "12px 24px 20px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "relative",
                zIndex: 1,
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", letterSpacing: "2px", fontWeight: 600 }}>
                  {monthLabel.toUpperCase()}
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {t("daysTrackedSuffix").replace("{tracked}", String(card.daysTracked)).replace("{total}", String(card.daysInMonth))}
                </span>
              </div>
            </div>
          </div>


          {/* Fun Stats */}
          <div className="glass-panel" style={{
            padding: "24px",
            width: "100%",
            maxWidth: "340px",
            borderRadius: '24px'
          }}>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", fontWeight: 700, letterSpacing: "2px", textTransform: 'uppercase' }}>
              {t("breakdown")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {(Object.keys(STAT_LABELS) as Array<keyof typeof STAT_LABELS>).map((key) => {
                const val = card.stats[key as keyof CardData["stats"]];
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ width: "28px", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>{STAT_LABELS[key]}</span>
                      <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                        <div style={{
                          width: `${(val / 99) * 100}%`,
                          height: "100%",
                          borderRadius: "4px",
                          background: theme.gradient,
                          transition: "width 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                          boxShadow: `0 0 10px ${card.rarity === 'diamond' ? 'rgba(0, 255, 255, 0.3)' : 'rgba(255, 107, 0, 0.3)'}`
                        }} />
                      </div>
                      <span style={{ width: "28px", textAlign: "right", fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>{val}</span>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "40px", opacity: 0.8 }}>
                      {t(`${key}Desc` as any)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: "100px" }} />
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "80px 20px", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏟️</div>
          <p>{t("noDataMonth")}</p>
          <p style={{ fontSize: "13px", marginTop: "8px", opacity: 0.6 }}>{t("startTrackingPrompt")}</p>
        </div>
      )}
    </div>
  );
}
