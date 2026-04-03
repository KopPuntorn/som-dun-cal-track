import type { ReactNode } from "react";
import { format } from "date-fns";

type UnifiedActivity = {
  id: string;
  type: "food" | "exercise" | "sleep" | "weight";
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

type FeedItemCardProps = {
  item: UnifiedActivity;
  sleepLabel: string;
  goodQualityLabel: string;
  fairQualityLabel: string;
  poorQualityLabel: string;
  relogTitle?: string;
  onRelog?: () => void;
  onEdit?: () => void;
  onDelete: () => void;
};

export default function FeedItemCard({
  item,
  sleepLabel,
  goodQualityLabel,
  fairQualityLabel,
  poorQualityLabel,
  relogTitle,
  onRelog,
  onEdit,
  onDelete,
}: FeedItemCardProps) {
  let icon = "📝";
  let color = "var(--text-primary)";
  let stats: ReactNode = null;

  if (item.type === "food") {
    const category = (item.category || "Breakfast").toLowerCase();
    if (category === "breakfast") icon = "🍳";
    else if (category === "lunch") icon = "🥗";
    else if (category === "dinner") icon = "🍲";
    else icon = "🍪";
    color = "var(--accent-cal)";
    stats = (
      <span>
        <strong style={{ color }}>{item.calories}</strong> kcal
        {item.protein ? <span> | <strong>{item.protein}</strong>g P</span> : null}
        {item.carbs ? <span> | <strong>{item.carbs}</strong>g C</span> : null}
        {item.fat ? <span> | <strong>{item.fat}</strong>g F</span> : null}
      </span>
    );
  } else if (item.type === "exercise") {
    icon = "🏃";
    color = "var(--accent-pro)";
    stats = (
      <span>
        <strong>{item.duration}</strong> min | <strong style={{ color }}>{item.calories}</strong> kcal
      </span>
    );
  } else if (item.type === "sleep") {
    icon = "🌙";
    color = "var(--accent-fat)";
    const qualityLabel = item.category === "Good"
      ? goodQualityLabel
      : item.category === "Fair"
      ? fairQualityLabel
      : poorQualityLabel;
    stats = (
      <span>
        <strong>{item.duration}</strong> hrs | {qualityLabel}
      </span>
    );
  } else if (item.type === "weight") {
    icon = "⚖️";
    color = "#38bdf8";
    stats = (
      <span>
        <strong style={{ color }}>{item.weight}</strong> kg
      </span>
    );
  }

  return (
    <div className="food-item feed-item-card" style={{ padding: "12px 20px", borderLeft: `4px solid ${color}` }}>
      <div className="feed-item-main">
        <div className="feed-item-icon" aria-hidden="true">
          {icon}
        </div>
        <div className="food-info">
          <h4 style={{ fontSize: "14px", fontWeight: 600 }}>
            {item.name || (item.type === "sleep" ? sleepLabel : item.type)}
          </h4>
          <div className="food-stats" style={{ marginTop: "2px", fontSize: "12px", opacity: 0.8 }}>
            {stats}
          </div>
        </div>
        <div className="feed-item-time">{format(new Date(item.date), "HH:mm")}</div>
      </div>

      <div className="feed-item-actions">
        {onRelog && (
          <button className="icon-btn" title={relogTitle} onClick={onRelog} style={{ width: "32px", height: "32px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        )}
        {onEdit && (
          <button className="icon-btn" onClick={onEdit} style={{ width: "32px", height: "32px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        )}
        <button className="icon-btn delete-btn-hover" onClick={onDelete} style={{ width: "32px", height: "32px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}
