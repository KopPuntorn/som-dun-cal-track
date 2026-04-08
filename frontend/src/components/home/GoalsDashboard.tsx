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
  const calPercent = Math.min(100, Math.max(0, (calTotal / adjustedCalGoal) * 100));
  const remainingAmount = Math.abs(calRemaining);

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
        </div>

        <div className="goals-energy-body">
          <div className="goals-energy-summary">
            <div className="goals-energy-hero">
              <div className="goals-energy-main">
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
              <p className="goals-energy-summary-note">
                {remainingAmount} kcal {isOverCal ? overLabel.toLowerCase() : remainingLabel.toLowerCase()}
              </p>
            </div>

            <div className="goals-energy-meter" aria-hidden="true">
              <div className="goals-energy-meter-track">
                <motion.span
                  className={`goals-energy-meter-fill ${isOverCal ? "is-over" : ""}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${loading ? 0 : calPercent}%` }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="goals-energy-meter-label">{Math.round(calPercent)}%</span>
            </div>
          </div>

          <div className={`goals-energy-stats${burnedToday > 0 ? " has-bonus" : ""}`}>
            <div className="goals-energy-stat goals-energy-stat--target">
              <span className="goals-energy-stat-value">{caloriesTarget}</span>
              <span className="goals-energy-stat-label">{targetLabel}</span>
            </div>
            <div className="goals-energy-stat goals-energy-stat--remaining">
              <span className={`goals-energy-stat-value ${isOverCal ? "is-over" : ""}`}>{remainingAmount}</span>
              <span className="goals-energy-stat-label">{isOverCal ? overLabel : remainingLabel}</span>
            </div>
            {burnedToday > 0 && (
              <div className="goals-energy-stat goals-energy-stat--accent">
                <span className="goals-energy-stat-value">+{burnedToday}</span>
                <span className="goals-energy-stat-label">{activeBonusLabel}</span>
              </div>
            )}
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
                <div className="goals-macro-copy">
                  <span className="goals-macro-label">{macro.label}</span>
                  <p className="goals-macro-note">
                    {macro.isComplete ? onTargetLabel : `${macro.remaining}g ${remainingLabel}`}
                  </p>
                </div>
                <span className="goals-macro-amount">
                  {macro.consumed}
                  <small>/ {macro.goal}g</small>
                </span>
              </div>
              <div className="goals-macro-progress-row">
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
                <span className="goals-macro-progress">{Math.round(Math.min(100, macro.percent))}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.article>
    </section>
  );
}
