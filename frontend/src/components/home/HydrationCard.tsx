type HydrationCardProps = {
  title: string;
  goalLabel: string;
  glassesLabel: string;
  remainingLabel: string;
  waterGlasses: number;
  hydrationGoal: number;
  waterPercent: number;
  waterRemaining: number;
  decrementAriaLabel: string;
  incrementAriaLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
};

export default function HydrationCard({
  title,
  goalLabel,
  glassesLabel,
  remainingLabel,
  waterGlasses,
  hydrationGoal,
  waterPercent,
  waterRemaining,
  decrementAriaLabel,
  incrementAriaLabel,
  onDecrement,
  onIncrement,
}: HydrationCardProps) {
  return (
    <section className="glass-panel daily-progress-panel">
      <div className="daily-progress-header">
        <h3 className="daily-progress-heading">{title}</h3>
      </div>

      <article className="daily-progress-card daily-progress-card--water">
        <div className="daily-progress-card-top">
          <div className="daily-progress-card-copy">
            <div className="daily-progress-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
              </svg>
            </div>
            <div>
              <p className="daily-progress-card-label">{title}</p>
              <p className="daily-progress-card-target">{goalLabel}: {hydrationGoal}</p>
            </div>
          </div>
          <span className="daily-progress-tag">{Math.round(waterPercent)}%</span>
        </div>

        <div className="daily-progress-card-value">
          <span>{waterGlasses}</span>
          <small>/ {hydrationGoal} {glassesLabel}</small>
        </div>

        <div className="daily-progress-meter" aria-hidden="true">
          <span style={{ width: `${waterPercent}%` }} />
        </div>

        <p className="daily-progress-card-note">
          {waterRemaining} {glassesLabel} {remainingLabel}
        </p>

        <div className="daily-progress-stepper">
          <button
            type="button"
            onClick={onDecrement}
            className="glass-btn daily-progress-step-btn"
            aria-label={decrementAriaLabel}
          >
            -1
          </button>
          <button
            type="button"
            onClick={onIncrement}
            className="glass-btn active daily-progress-step-btn"
            aria-label={incrementAriaLabel}
          >
            +1
          </button>
        </div>
      </article>
    </section>
  );
}
