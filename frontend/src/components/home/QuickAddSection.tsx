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
  foods: QuickAddFood[];
  onQuickAdd: (food: QuickAddFood) => void;
};

export default function QuickAddSection({
  title,
  foods,
  onQuickAdd,
}: QuickAddSectionProps) {
  if (!foods.length) {
    return null;
  }

  return (
    <section className="glass-panel quick-add-panel">
      <h3 className="quick-actions-heading">{title}</h3>
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
            {food.name}
          </motion.button>
        ))}
      </div>
    </section>
  );
}
