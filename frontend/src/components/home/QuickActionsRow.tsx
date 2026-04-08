type QuickActionsRowProps = {
  title: string;
  description: string;
  addFoodLabel: string;
  addFoodHint: string;
  logActivityLabel: string;
  logActivityHint: string;
  onAddFood: () => void;
  onLogActivity: () => void;
};

export default function QuickActionsRow({
  title,
  description,
  addFoodLabel,
  addFoodHint,
  logActivityLabel,
  logActivityHint,
  onAddFood,
  onLogActivity,
}: QuickActionsRowProps) {
  return (
    <section className="glass-panel quick-actions-panel">
      <div className="quick-actions-header">
        <h3 className="quick-actions-heading">{title}</h3>
        <p className="quick-actions-description">{description}</p>
      </div>
      <div className="quick-actions-grid">
        <div id="add-food-btn" className="quick-action-anchor">
          <button id="add-food-btn-mobile" type="button" className="glass-btn quick-action-btn quick-action-btn--food" onClick={onAddFood}>
            <span className="quick-action-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </span>
            <span className="quick-action-copy">
              <strong>{addFoodLabel}</strong>
              <small>{addFoodHint}</small>
            </span>
          </button>
        </div>
        <div id="log-activity-btn" className="quick-action-anchor">
          <button id="log-activity-btn-mobile" type="button" className="glass-btn quick-action-btn quick-action-btn--activity" onClick={onLogActivity}>
            <span className="quick-action-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </span>
            <span className="quick-action-copy">
              <strong>{logActivityLabel}</strong>
              <small>{logActivityHint}</small>
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
