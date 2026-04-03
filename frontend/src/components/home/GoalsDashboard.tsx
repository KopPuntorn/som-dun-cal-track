import { motion } from "framer-motion";

type MacroTone = "protein" | "carbs" | "fat";

type MacroGoal = {
  tone: MacroTone;
  label: string;
  consumed: number;
  goal: number;
  percent: number;
  remaining: number;
  isComplete?: boolean;
};

type GoalsDashboardProps = {
  dailyTargetsLabel: string;
  dailyGoalsLabel: string;
  caloriesLabel: string;
  targetLabel: string;
  activeBonusLabel: string;
  remainingLabel: string;
  overLabel: string;
  onTargetLabel: string;
  caloriesTarget: number;
  adjustedCalGoal: number;
  calTotal: number;
  calRemaining: number;
  burnedToday: number;
  isOverCal: boolean;
  loading: boolean;
  macros: MacroGoal[];
};

export default function GoalsDashboard({
  dailyTargetsLabel,
  dailyGoalsLabel,
  caloriesLabel,
  targetLabel,
  activeBonusLabel,
  remainingLabel,
  overLabel,
  onTargetLabel,
  caloriesTarget,
  adjustedCalGoal,
  calTotal,
  calRemaining,
  burnedToday,
  isOverCal,
  loading,
  macros,
}: GoalsDashboardProps) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const calPercent = Math.min(100, Math.max(0, (calTotal / adjustedCalGoal) * 100));

  return (
    <section className="goals-dashboard">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel goals-energy-card"
      >
        <div className="goals-card-header">
          <div>
            <p className="goals-card-eyebrow">{dailyTargetsLabel}</p>
            <h2 className="goals-card-title">{caloriesLabel}</h2>
          </div>
          {burnedToday > 0 && <span className="goals-bonus-chip">+{burnedToday}</span>}
        </div>

        <div className="goals-energy-body">
          <div className="goals-energy-ring-wrap">
            <svg className="progress-ring" viewBox="0 0 160 160" style={{ width: "100%", height: "auto" }}>
              <defs>
                <linearGradient id="goals-cal-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff7ed" />
                  <stop offset="30%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <circle
                className="ring-bg"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="10"
                fill="none"
                r={radius}
                cx="80"
                cy="80"
              />

              {/* Layer 1: Ambient Glow (Radiance) */}
              <circle
                className="ring-glow-ambient"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
                r={radius}
                cx="80"
                cy="80"
                stroke={isOverCal ? "rgba(239, 68, 68, 0.4)" : "rgba(249, 115, 22, 0.4)"}
                strokeDasharray={`${loading ? 0 : (calPercent / 100) * circumference} ${circumference}`}
                transform="rotate(-90 80 80)"
                style={{
                  transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  filter: "blur(5px)",
                  opacity: loading ? 0 : 1,
                }}
              />

              {/* Layer 2: Core Glow (Neon Intensity) */}
              <circle
                className="ring-glow-core"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
                r={radius}
                cx="80"
                cy="80"
                stroke={isOverCal ? "rgba(239, 68, 68, 0.5)" : "rgba(251, 146, 60, 0.5)"}
                strokeDasharray={`${loading ? 0 : (calPercent / 100) * circumference} ${circumference}`}
                transform="rotate(-90 80 80)"
                style={{
                  transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  filter: "blur(2px)",
                  opacity: loading ? 0 : 1,
                }}
              />

              {/* Layer 3: Solid Segment (Precision) */}
              <circle
                className="ring-progress"
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                r={radius}
                cx="80"
                cy="80"
                stroke={isOverCal ? "#ef4444" : "url(#goals-cal-gradient)"}
                strokeDasharray={`${loading ? 0 : (calPercent / 100) * circumference} ${circumference}`}
                transform="rotate(-90 80 80)"
                style={{
                  transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </svg>

            <div className="goals-energy-ring-copy">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                key={calTotal}
                className={`goals-energy-value ${isOverCal ? "is-over" : ""}`}
              >
                {calTotal}
              </motion.span>
              <span className="goals-energy-goal">/ {adjustedCalGoal} kcal</span>
            </div>
          </div>

          <div className="goals-energy-stats">
            <div className="goals-energy-stat">
              <span className="goals-energy-stat-value">{caloriesTarget}</span>
              <span className="goals-energy-stat-label">{targetLabel}</span>
            </div>
            <div className="goals-energy-stat goals-energy-stat--accent">
              <span className="goals-energy-stat-value">+{burnedToday}</span>
              <span className="goals-energy-stat-label">{activeBonusLabel}</span>
            </div>
            <div className="goals-energy-stat">
              <span className={`goals-energy-stat-value ${isOverCal ? "is-over" : ""}`}>{calRemaining}</span>
              <span className="goals-energy-stat-label">{isOverCal ? overLabel : remainingLabel}</span>
            </div>
          </div>
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-panel goals-macros-card"
      >
        <div className="goals-card-header">
          <div>
            <p className="goals-card-eyebrow">{dailyTargetsLabel}</p>
            <h2 className="goals-card-title">{dailyGoalsLabel}</h2>
          </div>
        </div>

        <div className="goals-macro-list">
          {macros.map((macro, idx) => (
            <motion.div
              key={macro.tone}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
              className={`goals-macro goals-macro--${macro.tone}${macro.isComplete ? " is-complete" : ""}`}
            >
              <div className="goals-macro-top">
                <span className="goals-macro-label">
                  {macro.label}
                  {macro.isComplete && <strong>{onTargetLabel}</strong>}
                </span>
                <span className="goals-macro-amount">
                  {macro.consumed}
                  <small>/ {macro.goal}g</small>
                </span>
              </div>
              <div className="goals-macro-meter">
                <div className="goals-macro-meter-bg">
                  <motion.span
                    className={`goals-macro-meter-fill goals-macro-meter-fill--${macro.tone}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, macro.percent)}%` }}
                    transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.5 + idx * 0.1 }}
                  />
                </div>
              </div>
              <p className="goals-macro-note">{macro.remaining}g {remainingLabel}</p>
            </motion.div>
          ))}
        </div>
      </motion.article>
    </section>
  );
}
