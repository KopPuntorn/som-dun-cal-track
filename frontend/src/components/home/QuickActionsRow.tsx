type QuickActionsRowProps = {
  title: string;
  addFoodLabel: string;
  logActivityLabel: string;
  onAddFood: () => void;
  onLogActivity: () => void;
};

export default function QuickActionsRow({
  title,
  addFoodLabel,
  logActivityLabel,
  onAddFood,
  onLogActivity,
}: QuickActionsRowProps) {
  return (
    <section className="glass-panel quick-actions-panel">
      <h3 className="quick-actions-heading">{title}</h3>
      <div className="quick-actions-grid">
        <div id="add-food-btn" className="quick-action-anchor">
          <button id="add-food-btn-mobile" type="button" className="glass-btn quick-action-btn" onClick={onAddFood}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 5px rgba(249,115,22,0.4))" }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span style={{ marginLeft: '4px' }}>{addFoodLabel}</span>
          </button>
        </div>
        <div id="log-activity-btn" className="quick-action-anchor">
          <button id="log-activity-btn-mobile" type="button" className="glass-btn quick-action-btn" onClick={onLogActivity}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 5px rgba(34,197,94,0.4))" }}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span style={{ marginLeft: '4px' }}>{logActivityLabel}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
