import { SkeletonFoodCard } from "@/components/LoadingSkeleton";
import FeedItemCard from "@/components/home/FeedItemCard";

type Food = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  sodium: number;
  fiber: number;
  mealCategory?: string;
  date: string;
};

type ExerciseRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  caloriesBurned: number;
  date: string;
};

type SleepRecord = {
  id: string;
  durationHours: number;
  quality: string;
  date: string;
};

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

type TodayFeedSectionProps = {
  title: string;
  description: string;
  loading: boolean;
  items: UnifiedActivity[];
  foods: Food[];
  exerciseRecords: ExerciseRecord[];
  sleepRecords: SleepRecord[];
  noItemsTitle: string;
  noItemsMessage: string;
  emptyActionLabel: string;
  sleepLabel: string;
  goodQualityLabel: string;
  fairQualityLabel: string;
  poorQualityLabel: string;
  relogTitle: string;
  onEmptyAction: () => void;
  onRelogFood: (food: Food) => void;
  onEditFood: (food: Food) => void;
  onEditExercise: (exercise: ExerciseRecord) => void;
  onEditSleep: (sleep: SleepRecord) => void;
  onDeleteFood: (id: string) => void;
  onDeleteExercise: (id: string) => void;
  onDeleteSleep: (id: string) => void;
};

export default function TodayFeedSection({
  title,
  description,
  loading,
  items,
  foods,
  exerciseRecords,
  sleepRecords,
  noItemsTitle,
  noItemsMessage,
  emptyActionLabel,
  sleepLabel,
  goodQualityLabel,
  fairQualityLabel,
  poorQualityLabel,
  relogTitle,
  onEmptyAction,
  onRelogFood,
  onEditFood,
  onEditExercise,
  onEditSleep,
  onDeleteFood,
  onDeleteExercise,
  onDeleteSleep,
}: TodayFeedSectionProps) {
  return (
    <section className="foods-list-section">
      <div className="home-section-header">
        <h3 className="section-title home-section-title">{title}</h3>
        <p className="home-section-description">{description}</p>
      </div>
      <div className="foods-list">
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[1, 2, 3].map((item) => (
              <SkeletonFoodCard key={item} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel home-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <div className="home-empty-title">{noItemsTitle}</div>
            <div className="home-empty-copy">{noItemsMessage}</div>
            <button type="button" className="glass-btn home-empty-cta" onClick={onEmptyAction}>
              {emptyActionLabel}
            </button>
          </div>
        ) : (
          <div className="home-feed-list">
            {items.map((item) => {
              const foodItem = item.type === "food" ? foods.find((food) => food.id === item.id) : undefined;
              const exerciseItem = item.type === "exercise" ? exerciseRecords.find((exercise) => exercise.id === item.id) : undefined;
              const sleepItem = item.type === "sleep" ? sleepRecords.find((sleep) => sleep.id === item.id) : undefined;

              return (
                <FeedItemCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  sleepLabel={sleepLabel}
                  goodQualityLabel={goodQualityLabel}
                  fairQualityLabel={fairQualityLabel}
                  poorQualityLabel={poorQualityLabel}
                  relogTitle={item.type === "food" ? relogTitle : undefined}
                  onRelog={foodItem ? () => onRelogFood(foodItem) : undefined}
                  onEdit={
                    item.type === "food" && foodItem
                      ? () => onEditFood(foodItem)
                      : item.type === "exercise" && exerciseItem
                      ? () => onEditExercise(exerciseItem)
                      : item.type === "sleep" && sleepItem
                      ? () => onEditSleep(sleepItem)
                      : undefined
                  }
                  onDelete={() => {
                    if (item.type === "food") onDeleteFood(item.id);
                    if (item.type === "exercise") onDeleteExercise(item.id);
                    if (item.type === "sleep") onDeleteSleep(item.id);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
