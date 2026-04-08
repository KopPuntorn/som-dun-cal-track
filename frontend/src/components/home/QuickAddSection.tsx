import { motion } from "framer-motion";

type QuickAddFood = {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugar?: number;
  sodium?: number;
  fiber?: number;
};

type QuickAddSectionProps = {
  title: string;
  description: string;
  foods: QuickAddFood[];
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel: string;
  onQuickAdd: (food: QuickAddFood) => void;
  onOpenAddFood: () => void;
};

export default function QuickAddSection({
  title,
  description,
  foods,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onQuickAdd,
  onOpenAddFood,
}: QuickAddSectionProps) {
  return (
    <section className="glass-panel quick-add-panel">
      <div className="quick-add-header">
        <h3 className="quick-actions-heading">{title}</h3>
        <p className="quick-add-description">{description}</p>
      </div>

      {foods.length ? (
        <div className="quick-add-chip-list">
          {foods.slice(0, 6).map((food, index) => (
            <motion.button
              key={`${food.name}-${index}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              type="button"
              onClick={() => onQuickAdd(food)}
              className="glass-btn quick-add-chip"
            >
              <span className="quick-add-chip-plus">+</span>
              <span className="quick-add-chip-copy">
                <strong>{food.name}</strong>
                <small>{food.calories} kcal</small>
              </span>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="quick-add-empty">
          <div>
            <strong>{emptyTitle}</strong>
            <p>{emptyMessage}</p>
          </div>
          <button type="button" className="glass-btn quick-add-empty-btn" onClick={onOpenAddFood}>
            {emptyActionLabel}
          </button>
        </div>
      )}
    </section>
  );
}
