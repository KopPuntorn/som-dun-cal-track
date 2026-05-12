package handlers

import (
	"context"
	// "crypto/sha256"
	// "fmt"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"backend/internal/db"
	"backend/internal/models"

	"github.com/labstack/echo/v4"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type UnifiedActivity struct {
	ID       primitive.ObjectID `json:"id"`
	Type     string             `json:"type"` // food, exercise, sleep, weight
	Name     string             `json:"name"`
	Date     time.Time          `json:"date"`
	Calories float64            `json:"calories,omitempty"`
	Protein  *float64           `json:"protein,omitempty"`
	Carbs    *float64           `json:"carbs,omitempty"`
	Fat      *float64           `json:"fat,omitempty"`
	Duration float64            `json:"duration,omitempty"` // minutes or hours
	Weight   float64            `json:"weight,omitempty"`
	Category string             `json:"category,omitempty"` // mealCategory or quality
}

type DashboardSummary struct {
	User            PublicUserResponse       `json:"user"`
	Goals           models.Goals             `json:"goals"`
	TodayFoods      []models.Food            `json:"todayFoods"`
	WaterToday      models.WaterIntake       `json:"waterToday"`
	WeightRecent    []models.WeightRecord    `json:"weightRecent"`
	Exercise        []models.ExerciseRecord  `json:"exerciseRecent"`
	Sleep           []models.SleepRecord     `json:"sleepRecent"`
	Measurements    []models.BodyMeasurement `json:"measurementsRecent"`
	RecentFoods     []models.FoodTemplate    `json:"recentFoods"`
	UnifiedHistory  []UnifiedActivity        `json:"unifiedHistory"`
	DailyBrief      DailyBrief               `json:"dailyBrief"`
	SevenDayInsight SevenDayInsight          `json:"sevenDayInsight"`
}

type DailyBrief struct {
	Eyebrow       string             `json:"eyebrow"`
	Title         string             `json:"title"`
	Summary       string             `json:"summary"`
	FocusLabel    string             `json:"focusLabel"`
	FocusValue    string             `json:"focusValue"`
	MomentumLabel string             `json:"momentumLabel"`
	MomentumValue string             `json:"momentumValue"`
	Signals       []DailyBriefSignal `json:"signals"`
	Actions       []DailyBriefAction `json:"actions"`
}

type DailyBriefSignal struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Tone  string `json:"tone"`
}

type DailyBriefAction struct {
	Label   string `json:"label"`
	Prompt  string `json:"prompt"`
	Variant string `json:"variant"`
}

type SevenDayInsight struct {
	Eyebrow  string                `json:"eyebrow"`
	Title    string                `json:"title"`
	Summary  string                `json:"summary"`
	Stats    []SevenDayInsightStat `json:"stats"`
	CtaLabel string                `json:"ctaLabel"`
	Prompt   string                `json:"prompt"`
}

type SevenDayInsightStat struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Tone  string `json:"tone"`
}

func GetDashboardSummary(c echo.Context) error {
	userID := c.Get("userID").(primitive.ObjectID)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var summary DashboardSummary
	var weeklyFoods []models.Food
	var weeklyWater []models.WaterIntake
	weeklyStart := time.Now().In(time.Local).AddDate(0, 0, -6)
	weeklyStart = time.Date(weeklyStart.Year(), weeklyStart.Month(), weeklyStart.Day(), 0, 0, 0, 0, weeklyStart.Location())
	weeklyEnd := time.Now().In(time.Local)
	weeklyEnd = time.Date(weeklyEnd.Year(), weeklyEnd.Month(), weeklyEnd.Day(), 23, 59, 59, int(time.Second-time.Nanosecond), weeklyEnd.Location())
	weeklyStartDate := weeklyStart.Format("2006-01-02")
	weeklyEndDate := weeklyEnd.Format("2006-01-02")

	// Use WaitGroup for parallel fetching
	var wg sync.WaitGroup
	var mu sync.Mutex

	// 1. Get User (Required first or context for others? Actually independent)
	wg.Add(1)
	go func() {
		defer wg.Done()
		var u models.User
		if err := db.UserCollection.FindOne(ctx, bson.M{"_id": userID}).Decode(&u); err == nil {
			mu.Lock()
			summary.User = buildPublicUserResponse(u)
			mu.Unlock()
		}
	}()

	// 2. Get Goals
	wg.Add(1)
	go func() {
		defer wg.Done()
		var g models.Goals
		if err := db.GoalsCollection.FindOne(ctx, bson.M{"userId": userID}).Decode(&g); err == nil {
			mu.Lock()
			summary.Goals = g
			mu.Unlock()
		} else {
			mu.Lock()
			summary.Goals = models.Goals{Calories: 2000, Protein: 150, Carbs: 250, Fat: 70, ExerciseMinutesGoal: 30}
			mu.Unlock()
		}
	}()

	// Determine range for historical data
	startStr := c.QueryParam("start")
	endStr := c.QueryParam("end")
	var start, end time.Time
	hasRange := false
	waterDate := time.Now().Format("2006-01-02")
	if startStr != "" && endStr != "" {
		s, errS := time.Parse(time.RFC3339, startStr)
		e, errE := time.Parse(time.RFC3339, endStr)
		if errS == nil && errE == nil {
			start = s
			end = e
			hasRange = true
			waterDate = end.In(time.Local).Format("2006-01-02")
		}
	}

	// 3. Get Foods
	wg.Add(1)
	go func() {
		defer wg.Done()
		foodFilter := bson.M{"userId": userID}
		if hasRange {
			foodFilter["date"] = bson.M{"$gte": start, "$lte": end}
		} else {
			now := time.Now()
			startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			endOfDay := startOfDay.AddDate(0, 0, 1).Add(-time.Nanosecond)
			foodFilter["date"] = bson.M{"$gte": startOfDay, "$lte": endOfDay}
		}
		var foods []models.Food
		foodCursor, _ := db.FoodsCollection.Find(ctx, foodFilter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
		if foodCursor != nil {
			foodCursor.All(ctx, &foods)
		}
		mu.Lock()
		if foods == nil {
			summary.TodayFoods = []models.Food{}
		} else {
			summary.TodayFoods = foods
		}
		mu.Unlock()
	}()

	// 4. Get Water Today
	wg.Add(1)
	go func() {
		defer wg.Done()
		var w models.WaterIntake
		if err := db.WaterCollection.FindOne(ctx, bson.M{"date": waterDate, "userId": userID}).Decode(&w); err == nil {
			mu.Lock()
			summary.WaterToday = w
			mu.Unlock()
		} else {
			mu.Lock()
			summary.WaterToday = models.WaterIntake{Date: waterDate, Glasses: 0}
			mu.Unlock()
		}
	}()

	// 4b. Get Foods for the last 7 days
	wg.Add(1)
	go func() {
		defer wg.Done()
		filter := bson.M{
			"userId": userID,
			"date":   bson.M{"$gte": weeklyStart, "$lte": weeklyEnd},
		}
		var foods []models.Food
		cursor, _ := db.FoodsCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
		if cursor != nil {
			cursor.All(ctx, &foods)
		}
		mu.Lock()
		if foods == nil {
			weeklyFoods = []models.Food{}
		} else {
			weeklyFoods = foods
		}
		mu.Unlock()
	}()

	// 4c. Get Water records for the last 7 days
	wg.Add(1)
	go func() {
		defer wg.Done()
		filter := bson.M{
			"userId": userID,
			"date":   bson.M{"$gte": weeklyStartDate, "$lte": weeklyEndDate},
		}
		var waterRecords []models.WaterIntake
		cursor, _ := db.WaterCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "date", Value: -1}}))
		if cursor != nil {
			cursor.All(ctx, &waterRecords)
		}
		mu.Lock()
		if waterRecords == nil {
			weeklyWater = []models.WaterIntake{}
		} else {
			weeklyWater = waterRecords
		}
		mu.Unlock()
	}()

	// 5. Weight
	wg.Add(1)
	go func() {
		defer wg.Done()
		weightFilter := bson.M{"userId": userID}
		if hasRange {
			weightFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		weightOpts := options.Find().SetSort(bson.D{{Key: "date", Value: 1}})
		if !hasRange {
			weightOpts.SetLimit(30).SetSort(bson.D{{Key: "date", Value: -1}})
		}
		var weights []models.WeightRecord
		weightCursor, _ := db.WeightCollection.Find(ctx, weightFilter, weightOpts)
		if weightCursor != nil {
			weightCursor.All(ctx, &weights)
		}
		mu.Lock()
		if weights == nil {
			summary.WeightRecent = []models.WeightRecord{}
		} else {
			summary.WeightRecent = weights
		}
		mu.Unlock()
	}()

	// 6. Exercise
	wg.Add(1)
	go func() {
		defer wg.Done()
		exFilter := bson.M{"userId": userID}
		if hasRange {
			exFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		exOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			exOpts.SetLimit(30)
		}
		var exercises []models.ExerciseRecord
		exCursor, _ := db.ExerciseCollection.Find(ctx, exFilter, exOpts)
		if exCursor != nil {
			exCursor.All(ctx, &exercises)
		}
		mu.Lock()
		if exercises == nil {
			summary.Exercise = []models.ExerciseRecord{}
		} else {
			summary.Exercise = exercises
		}
		mu.Unlock()
	}()

	// 7. Sleep
	wg.Add(1)
	go func() {
		defer wg.Done()
		sleepFilter := bson.M{"userId": userID}
		if hasRange {
			sleepFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		sleepOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			sleepOpts.SetLimit(30)
		}
		var sleep []models.SleepRecord
		sleepCursor, _ := db.SleepCollection.Find(ctx, sleepFilter, sleepOpts)
		if sleepCursor != nil {
			sleepCursor.All(ctx, &sleep)
		}
		mu.Lock()
		if sleep == nil {
			summary.Sleep = []models.SleepRecord{}
		} else {
			summary.Sleep = sleep
		}
		mu.Unlock()
	}()

	// 8. Measurements
	wg.Add(1)
	go func() {
		defer wg.Done()
		mFilter := bson.M{"userId": userID}
		if hasRange {
			mFilter["date"] = bson.M{"$gte": start, "$lte": end}
		}
		mOpts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
		if !hasRange {
			mOpts.SetLimit(5)
		}
		var measurements []models.BodyMeasurement
		mCursor, _ := db.BodyMeasurementCollection.Find(ctx, mFilter, mOpts)
		if mCursor != nil {
			mCursor.All(ctx, &measurements)
		}
		mu.Lock()
		if measurements == nil {
			summary.Measurements = []models.BodyMeasurement{}
		} else {
			summary.Measurements = measurements
		}
		mu.Unlock()
	}()

	// 9. Recent Food Suggestions
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := ensureFoodTemplates(ctx, userID); err != nil {
			return
		}

		templateCursor, _ := db.FoodTemplatesCollection.Find(
			ctx,
			bson.M{"userId": userID},
			options.Find().
				SetSort(bson.D{{Key: "useCount", Value: -1}, {Key: "lastUsedAt", Value: -1}}).
				SetLimit(5),
		)
		if templateCursor != nil {
			var recentFoods []models.FoodTemplate
			templateCursor.All(ctx, &recentFoods)
			mu.Lock()
			if recentFoods == nil {
				summary.RecentFoods = []models.FoodTemplate{}
			} else {
				summary.RecentFoods = recentFoods
			}
			mu.Unlock()
		}
	}()

	wg.Wait()

	// --- Create Unified History (Feed) ---
	// Define date window for filtering feed items (if not already defined by hasRange)
	feedStart := start
	feedEnd := end
	if !hasRange {
		now := time.Now()
		feedStart = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		feedEnd = feedStart.AddDate(0, 0, 1).Add(-time.Nanosecond)
	}

	var unified []UnifiedActivity
	for _, f := range summary.TodayFoods {
		unified = append(unified, UnifiedActivity{
			ID:       f.ID,
			Type:     "food",
			Name:     f.Name,
			Date:     f.Date,
			Calories: f.Calories,
			Protein:  f.Protein,
			Carbs:    f.Carbs,
			Fat:      f.Fat,
			Category: f.MealCategory,
		})
	}
	for _, e := range summary.Exercise {
		// Only include in feed if it matches today/the requested range
		if e.Date.Before(feedStart) || e.Date.After(feedEnd) {
			continue
		}
		unified = append(unified, UnifiedActivity{
			ID:       e.ID,
			Type:     "exercise",
			Name:     e.Name,
			Date:     e.Date,
			Calories: models.SafeFloat(e.CaloriesBurned),
			Duration: float64(e.DurationMinutes),
		})
	}
	for _, s := range summary.Sleep {
		// Only include in feed if it matches today/the requested range
		if s.Date.Before(feedStart) || s.Date.After(feedEnd) {
			continue
		}
		unified = append(unified, UnifiedActivity{
			ID:       s.ID,
			Type:     "sleep",
			Name:     "Sleep Session",
			Date:     s.Date,
			Duration: s.DurationHours,
			Category: models.SafeString(s.Quality),
		})
	}

	// Sort by date descending
	sort.Slice(unified, func(i, j int) bool {
		return unified[i].Date.After(unified[j].Date)
	})
	summary.UnifiedHistory = unified
	lang := normalizeDashboardLanguage(c.QueryParam("lang"))
	summary.DailyBrief = buildDailyBrief(summary, lang)
	summary.SevenDayInsight = buildSevenDayInsight(summary.Goals, weeklyFoods, weeklyWater, summary.Exercise, summary.Sleep, lang)

	// Show tour logic should be after summary.User is fetched
	if summary.User.Onboarded && !summary.User.TourCompleted {
		summary.User.TourCompleted = false // Just to be explicit for summary struct
	}

	return c.JSON(http.StatusOK, summary)
}

func normalizeDashboardLanguage(lang string) string {
	if strings.EqualFold(strings.TrimSpace(lang), "en") {
		return "en"
	}
	return "th"
}

func buildDailyBrief(summary DashboardSummary, lang string) DailyBrief {
	calorieGoal := summary.Goals.Calories
	if calorieGoal <= 0 {
		calorieGoal = 2000
	}

	proteinGoal := summary.Goals.Protein
	if proteinGoal <= 0 {
		proteinGoal = 150
	}

	exerciseGoal := float64(summary.Goals.ExerciseMinutesGoal)
	if exerciseGoal <= 0 {
		exerciseGoal = 30
	}

	waterGoal := 8.0
	sleepGoal := 8.0

	var calorieTotal float64
	var proteinTotal float64
	for _, food := range summary.TodayFoods {
		calorieTotal += food.Calories
		proteinTotal += models.SafeFloat(food.Protein)
	}

	var exerciseMinutes float64
	for _, exercise := range summary.Exercise {
		exerciseMinutes += float64(exercise.DurationMinutes)
	}

	sleepHours := 0.0
	if len(summary.Sleep) > 0 {
		latestSleep := summary.Sleep[0]
		latestDate := latestSleep.Date.In(time.Local).Format("2006-01-02")
		today := time.Now().In(time.Local).Format("2006-01-02")
		if latestDate == today || time.Since(latestSleep.Date) < 24*time.Hour {
			sleepHours = latestSleep.DurationHours
		}
	}

	waterGlasses := float64(summary.WaterToday.Glasses)
	caloriePercent := briefPercent(calorieTotal, calorieGoal)
	proteinPercent := briefPercent(proteinTotal, proteinGoal)
	exercisePercent := briefPercent(exerciseMinutes, exerciseGoal)
	waterPercent := briefPercent(waterGlasses, waterGoal)
	sleepPercent := briefPercent(sleepHours, sleepGoal)
	momentum := math.Round((caloriePercent + proteinPercent + exercisePercent + waterPercent + sleepPercent) / 5)

	calorieRemaining := math.Max(0, calorieGoal-calorieTotal)
	proteinRemaining := math.Max(0, proteinGoal-proteinTotal)
	exerciseRemaining := math.Max(0, exerciseGoal-exerciseMinutes)
	waterRemaining := math.Max(0, waterGoal-waterGlasses)
	sleepRemaining := math.Max(0, sleepGoal-sleepHours)

	emptyDay := len(summary.TodayFoods) == 0 && summary.WaterToday.Glasses == 0 && exerciseMinutes == 0 && sleepHours == 0
	focusKey := "balance"
	focusValue := ""

	if emptyDay {
		focusKey = "start"
	} else {
		deficits := []struct {
			key       string
			percent   float64
			remaining float64
		}{
			{key: "protein", percent: proteinPercent, remaining: proteinRemaining},
			{key: "water", percent: waterPercent, remaining: waterRemaining},
			{key: "recovery", percent: sleepPercent, remaining: sleepRemaining},
			{key: "training", percent: exercisePercent, remaining: exerciseRemaining},
			{key: "energy", percent: caloriePercent, remaining: calorieRemaining},
		}

		sort.Slice(deficits, func(i, j int) bool {
			leftScore := deficits[i].remaining + (100 - deficits[i].percent)
			rightScore := deficits[j].remaining + (100 - deficits[j].percent)
			return leftScore > rightScore
		})
		focusKey = deficits[0].key
	}

	if lang == "en" {
		switch focusKey {
		case "start":
			focusValue = "Log the first win"
		case "protein":
			focusValue = fmt.Sprintf("+%sg protein", briefNumber(proteinRemaining))
		case "water":
			focusValue = fmt.Sprintf("+%s glasses", briefNumber(waterRemaining))
		case "recovery":
			focusValue = fmt.Sprintf("+%s h sleep", briefNumber(sleepRemaining))
		case "training":
			focusValue = fmt.Sprintf("+%s min training", briefNumber(exerciseRemaining))
		case "energy":
			focusValue = fmt.Sprintf("+%s kcal", briefNumber(calorieRemaining))
		default:
			focusValue = "Keep the balance"
		}
	} else {
		switch focusKey {
		case "start":
			focusValue = "เริ่มจากการบันทึกแรก"
		case "protein":
			focusValue = fmt.Sprintf("เพิ่มโปรตีนอีก %s กรัม", briefNumber(proteinRemaining))
		case "water":
			focusValue = fmt.Sprintf("ดื่มน้ำเพิ่มอีก %s แก้ว", briefNumber(waterRemaining))
		case "recovery":
			focusValue = fmt.Sprintf("พักเพิ่มอีกราว %s ชม.", briefNumber(sleepRemaining))
		case "training":
			focusValue = fmt.Sprintf("ขยับเพิ่มอีก %s นาที", briefNumber(exerciseRemaining))
		case "energy":
			focusValue = fmt.Sprintf("เติมพลังอีก %s kcal", briefNumber(calorieRemaining))
		default:
			focusValue = "รักษาสมดุลต่อเนื่อง"
		}
	}

	signals := []DailyBriefSignal{
		{
			Label: briefCopy(lang, "Energy", "พลังงาน"),
			Value: fmt.Sprintf("%s / %s kcal", briefNumber(calorieTotal), briefNumber(calorieGoal)),
			Tone:  "energy",
		},
		{
			Label: briefCopy(lang, "Protein", "โปรตีน"),
			Value: fmt.Sprintf("%s / %s g", briefNumber(proteinTotal), briefNumber(proteinGoal)),
			Tone:  "protein",
		},
		{
			Label: briefCopy(lang, "Water", "น้ำ"),
			Value: fmt.Sprintf("%s / %s", briefNumber(waterGlasses), briefNumber(waterGoal)),
			Tone:  "water",
		},
		{
			Label: briefCopy(lang, "Recovery", "ฟื้นฟู"),
			Value: fmt.Sprintf("%s / %s h", briefNumber(sleepHours), briefNumber(sleepGoal)),
			Tone:  "recovery",
		},
	}

	title := ""
	summaryText := ""
	actions := []DailyBriefAction{}

	if lang == "en" {
		switch focusKey {
		case "start":
			title = "Your day is still a blank canvas"
			summaryText = "Log the first meal, water, or activity so SomDun can turn today into a sharper coaching loop."
		case "protein":
			title = "Protein is the clearest gap right now"
			summaryText = fmt.Sprintf("You are about %s g short of your protein goal. A lean next meal would tighten up the whole day fast.", briefNumber(proteinRemaining))
		case "water":
			title = "Hydration is the easiest win this round"
			summaryText = fmt.Sprintf("You are about %s glasses behind your hydration target. Fixing that now will lift energy and recovery together.", briefNumber(waterRemaining))
		case "recovery":
			title = "Recovery needs protection tonight"
			summaryText = fmt.Sprintf("Sleep is pacing at %s hours, so the best move is to keep tonight's routine lighter and more repeatable.", briefNumber(sleepHours))
		case "training":
			title = "A short workout still changes the score"
			summaryText = fmt.Sprintf("You still have around %s minutes left on your activity goal. Even a compact session would move the day back on target.", briefNumber(exerciseRemaining))
		case "energy":
			title = "Energy intake is still trailing the target"
			summaryText = fmt.Sprintf("You're roughly %s kcal below today's target. A smarter next meal can close the gap without making macros messy.", briefNumber(calorieRemaining))
		default:
			title = "Momentum looks solid today"
			summaryText = "You're covering the main pillars well. The best next step is a clean, balanced finish rather than a big correction."
		}

		actions = buildDailyBriefActions(lang, focusKey, proteinRemaining, calorieRemaining, waterRemaining, exerciseRemaining, sleepRemaining)
	} else {
		switch focusKey {
		case "start":
			title = "วันนี้ยังเป็นกระดานว่างอยู่"
			summaryText = "เริ่มบันทึกมื้อแรก น้ำ หรือกิจกรรมก่อน แล้ว SomDun จะช่วยต่อยอดวันนี้ให้เป็น flow ที่ฉลาดขึ้นทันที"
		case "protein":
			title = "โปรตีนคือช่องว่างที่ชัดที่สุดตอนนี้"
			summaryText = fmt.Sprintf("วันนี้คุณยังขาดโปรตีนอีกราว %s กรัม ถ้าเลือกมื้อถัดไปให้แม่น วันทั้งวันจะกลับมาแน่นขึ้นทันที", briefNumber(proteinRemaining))
		case "water":
			title = "การดื่มน้ำคือแต้มที่เก็บได้ง่ายสุดตอนนี้"
			summaryText = fmt.Sprintf("คุณยังตามเป้าน้ำอยู่ราว %s แก้ว การเก็บจุดนี้ก่อนจะช่วยทั้งพลังงานและการฟื้นตัว", briefNumber(waterRemaining))
		case "recovery":
			title = "คืนนี้ควรเน้นการฟื้นตัวให้มากขึ้น"
			summaryText = fmt.Sprintf("การนอนล่าสุดอยู่ที่ประมาณ %s ชั่วโมง ดังนั้น step ที่คุ้มสุดคือทำให้คืนนี้เบาและนอนง่ายกว่าเดิม", briefNumber(sleepHours))
		case "training":
			title = "เพิ่มการขยับอีกนิด คะแนนวันนี้จะดีขึ้นชัด"
			summaryText = fmt.Sprintf("คุณยังเหลือเป้ากิจกรรมอีกราว %s นาที แม้เป็น session สั้น ๆ ก็ยังช่วยดันภาพรวมวันนี้ได้", briefNumber(exerciseRemaining))
		case "energy":
			title = "พลังงานรวมวันนี้ยังต่ำกว่าเป้า"
			summaryText = fmt.Sprintf("ตอนนี้คุณยังต่ำกว่าเป้าวันนี้ประมาณ %s kcal ถ้าวางมื้อถัดไปดี ๆ จะปิดช่องว่างได้โดยไม่ทำให้ macro เพี้ยน", briefNumber(calorieRemaining))
		default:
			title = "โมเมนตัมวันนี้กำลังมาดี"
			summaryText = "ภาพรวมของวันค่อนข้างบาลานซ์แล้ว สิ่งที่คุ้มสุดตอนนี้คือปิดวันให้เรียบและสม่ำเสมอ"
		}

		actions = buildDailyBriefActions(lang, focusKey, proteinRemaining, calorieRemaining, waterRemaining, exerciseRemaining, sleepRemaining)
	}

	return DailyBrief{
		Eyebrow:       briefCopy(lang, "Proactive Daily Brief", "สรุปเชิงรุกของวันนี้"),
		Title:         title,
		Summary:       summaryText,
		FocusLabel:    briefCopy(lang, "Primary focus", "โฟกัสหลัก"),
		FocusValue:    focusValue,
		MomentumLabel: briefCopy(lang, "Momentum", "โมเมนตัม"),
		MomentumValue: fmt.Sprintf("%d%%", int(momentum)),
		Signals:       signals,
		Actions:       actions,
	}
}

func buildDailyBriefActions(lang, focusKey string, proteinRemaining, calorieRemaining, waterRemaining, exerciseRemaining, sleepRemaining float64) []DailyBriefAction {
	if lang == "en" {
		actions := []DailyBriefAction{
			{
				Label:   "Full analysis",
				Prompt:  "Summarize my nutrition, hydration, activity, and recovery for today. Then tell me the top two adjustments I should make next.",
				Variant: "secondary",
			},
		}

		switch focusKey {
		case "start":
			actions = append(actions, DailyBriefAction{
				Label:   "Plan my first meal",
				Prompt:  "I have not logged anything yet today. Suggest the best first meal to start my day based on my current goals.",
				Variant: "primary",
			})
		case "protein":
			actions = append(actions, DailyBriefAction{
				Label:   "Build my next protein meal",
				Prompt:  fmt.Sprintf("Based on my logs today, suggest a next meal that adds about %s grams of protein without overshooting my calories.", briefNumber(proteinRemaining)),
				Variant: "primary",
			})
		case "water":
			actions = append(actions, DailyBriefAction{
				Label:   "Fix hydration for today",
				Prompt:  fmt.Sprintf("Help me close my hydration gap for the rest of today. I still need about %s glasses of water.", briefNumber(waterRemaining)),
				Variant: "primary",
			})
		case "recovery":
			actions = append(actions, DailyBriefAction{
				Label:   "Improve tonight's recovery",
				Prompt:  fmt.Sprintf("My recovery looks low today. Suggest a simple plan for tonight to improve sleep and recovery, aiming to add about %s more hours of rest.", briefNumber(sleepRemaining)),
				Variant: "primary",
			})
		case "training":
			actions = append(actions, DailyBriefAction{
				Label:   "Fit in a short workout",
				Prompt:  fmt.Sprintf("I still need about %s minutes of activity today. Suggest a short workout I can realistically do now.", briefNumber(exerciseRemaining)),
				Variant: "primary",
			})
		case "energy":
			actions = append(actions, DailyBriefAction{
				Label:   "Close the calorie gap smartly",
				Prompt:  fmt.Sprintf("I am about %s kcal below my target today. Suggest a balanced next meal or snack that fits my macros.", briefNumber(calorieRemaining)),
				Variant: "primary",
			})
		default:
			actions = append(actions, DailyBriefAction{
				Label:   "Keep the day balanced",
				Prompt:  "My day looks fairly balanced already. Suggest the smartest way to finish the day strong without overcorrecting.",
				Variant: "primary",
			})
		}

		return actions
	}

	actions := []DailyBriefAction{
		{
			Label:   "วิเคราะห์ทั้งวัน",
			Prompt:  "ช่วยสรุปโภชนาการ น้ำ การออกกำลังกาย และการฟื้นตัวของวันนี้ให้หน่อย แล้วบอก 2 อย่างที่ฉันควรแก้ต่อจากนี้",
			Variant: "secondary",
		},
	}

	switch focusKey {
	case "start":
		actions = append(actions, DailyBriefAction{
			Label:   "วางมื้อแรกให้ฉัน",
			Prompt:  "วันนี้ฉันยังไม่ได้บันทึกอะไรเลย ช่วยแนะนำมื้อแรกที่เหมาะกับเป้าหมายของฉันตอนนี้หน่อย",
			Variant: "primary",
		})
	case "protein":
		actions = append(actions, DailyBriefAction{
			Label:   "จัดมื้อถัดไปให้เน้นโปรตีน",
			Prompt:  fmt.Sprintf("จากสิ่งที่ฉันกินวันนี้ ช่วยแนะนำมื้อถัดไปที่เพิ่มโปรตีนได้ประมาณ %s กรัม โดยไม่ทำให้แคลอรี่เกินเป้ามากเกินไป", briefNumber(proteinRemaining)),
			Variant: "primary",
		})
	case "water":
		actions = append(actions, DailyBriefAction{
			Label:   "ปิดช่องว่างการดื่มน้ำ",
			Prompt:  fmt.Sprintf("ช่วยวางแผนการดื่มน้ำที่เหลือของวันนี้ให้หน่อย ตอนนี้ฉันยังต้องดื่มอีกประมาณ %s แก้ว", briefNumber(waterRemaining)),
			Variant: "primary",
		})
	case "recovery":
		actions = append(actions, DailyBriefAction{
			Label:   "ปรับคืนนี้ให้ฟื้นตัวดีขึ้น",
			Prompt:  fmt.Sprintf("วันนี้การฟื้นตัวของฉันยังต่ำ ช่วยแนะนำแผนคืนนี้แบบง่าย ๆ เพื่อให้นอนดีขึ้นและเพิ่มเวลาพักอีกประมาณ %s ชั่วโมง", briefNumber(sleepRemaining)),
			Variant: "primary",
		})
	case "training":
		actions = append(actions, DailyBriefAction{
			Label:   "หา workout สั้น ๆ ให้หน่อย",
			Prompt:  fmt.Sprintf("วันนี้ฉันยังเหลือเป้ากิจกรรมอีกราว %s นาที ช่วยแนะนำ workout สั้น ๆ ที่ทำได้จริงตอนนี้", briefNumber(exerciseRemaining)),
			Variant: "primary",
		})
	case "energy":
		actions = append(actions, DailyBriefAction{
			Label:   "ปิดช่องว่างแคลอรี่แบบสมาร์ต",
			Prompt:  fmt.Sprintf("วันนี้ฉันยังต่ำกว่าเป้าอยู่ประมาณ %s kcal ช่วยแนะนำมื้อหรือของว่างที่บาลานซ์และเข้ากับ macro ของฉัน", briefNumber(calorieRemaining)),
			Variant: "primary",
		})
	default:
		actions = append(actions, DailyBriefAction{
			Label:   "ช่วยปิดวันให้บาลานซ์",
			Prompt:  "วันนี้ภาพรวมค่อนข้างบาลานซ์แล้ว ช่วยแนะนำวิธีปิดวันให้ดีโดยไม่ต้องแก้เยอะเกินไป",
			Variant: "primary",
		})
	}

	return actions
}

func buildSevenDayInsight(goals models.Goals, foods []models.Food, waterRecords []models.WaterIntake, exercises []models.ExerciseRecord, sleepRecords []models.SleepRecord, lang string) SevenDayInsight {
	now := time.Now().In(time.Local)
	start := now.AddDate(0, 0, -6)
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())

	calorieGoal := goals.Calories
	if calorieGoal <= 0 {
		calorieGoal = 2000
	}
	proteinGoal := goals.Protein
	if proteinGoal <= 0 {
		proteinGoal = 150
	}
	exerciseGoal := float64(goals.ExerciseMinutesGoal)
	if exerciseGoal <= 0 {
		exerciseGoal = 30
	}

	type dayStat struct {
		calories float64
		protein  float64
		exercise float64
		sleep    float64
		water    float64
	}

	dayTotals := map[string]*dayStat{}
	for i := 0; i < 7; i++ {
		day := start.AddDate(0, 0, i).Format("2006-01-02")
		dayTotals[day] = &dayStat{}
	}

	for _, food := range foods {
		dayKey := food.Date.In(time.Local).Format("2006-01-02")
		if stats, ok := dayTotals[dayKey]; ok {
			stats.calories += food.Calories
			stats.protein += models.SafeFloat(food.Protein)
		}
	}

	for _, water := range waterRecords {
		if stats, ok := dayTotals[water.Date]; ok {
			stats.water = float64(water.Glasses)
		}
	}

	for _, exercise := range exercises {
		dayKey := exercise.Date.In(time.Local).Format("2006-01-02")
		if stats, ok := dayTotals[dayKey]; ok {
			stats.exercise += float64(exercise.DurationMinutes)
		}
	}

	for _, sleep := range sleepRecords {
		dayKey := sleep.Date.In(time.Local).Format("2006-01-02")
		if stats, ok := dayTotals[dayKey]; ok && sleep.DurationHours > stats.sleep {
			stats.sleep = sleep.DurationHours
		}
	}

	proteinHitDays := 0
	hydrationHitDays := 0
	activeDays := 0
	var totalSleep float64
	weekendDays := 0
	weekdayDays := 0
	var weekendCalories float64
	var weekdayCalories float64

	for i := 0; i < 7; i++ {
		dayTime := start.AddDate(0, 0, i)
		stats := dayTotals[dayTime.Format("2006-01-02")]
		if stats == nil {
			continue
		}

		if stats.protein >= proteinGoal {
			proteinHitDays++
		}
		if stats.water >= 8 {
			hydrationHitDays++
		}
		if stats.exercise >= exerciseGoal || stats.exercise > 0 {
			activeDays++
		}

		totalSleep += stats.sleep

		if dayTime.Weekday() == time.Saturday || dayTime.Weekday() == time.Sunday {
			weekendDays++
			weekendCalories += stats.calories
		} else {
			weekdayDays++
			weekdayCalories += stats.calories
		}
	}

	avgSleep := totalSleep / 7
	weekendDelta := 0.0
	if weekendDays > 0 && weekdayDays > 0 {
		weekendAvg := weekendCalories / float64(weekendDays)
		weekdayAvg := weekdayCalories / float64(weekdayDays)
		if weekdayAvg > 0 {
			weekendDelta = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100
		}
	}

	title := ""
	summary := ""
	prompt := ""

	switch {
	case proteinHitDays <= 2:
		title = briefCopy(lang, "Protein consistency is the swing factor this week", "ความสม่ำเสมอของโปรตีนคือจุดแกว่งหลักของสัปดาห์นี้")
		summary = briefCopy(
			lang,
			fmt.Sprintf("You only hit your protein goal on %d of the last 7 days, so muscle support and appetite control are likely drifting more than they need to.", proteinHitDays),
			fmt.Sprintf("คุณถึงเป้าโปรตีนเพียง %d จาก 7 วันล่าสุด ทำให้ทั้งการซัพพอร์ตกล้ามเนื้อและการคุมความอิ่มยังแกว่งกว่าที่ควร", proteinHitDays),
		)
		prompt = briefCopy(
			lang,
			fmt.Sprintf("Review my last 7 days and help me fix protein consistency. I only hit my protein goal on %d of 7 days. Suggest the simplest meal strategy for next week.", proteinHitDays),
			fmt.Sprintf("ช่วยวิเคราะห์ 7 วันล่าสุดของฉันและแก้เรื่องความสม่ำเสมอของโปรตีนให้หน่อย ฉันถึงเป้าโปรตีนแค่ %d จาก 7 วัน ช่วยวางกลยุทธ์มื้ออาหารที่ทำตามง่ายสำหรับสัปดาห์หน้า", proteinHitDays),
		)
	case hydrationHitDays <= 2:
		title = briefCopy(lang, "Hydration gaps are piling up across the week", "ช่องว่างเรื่องการดื่มน้ำกำลังสะสมทั้งสัปดาห์")
		summary = briefCopy(
			lang,
			fmt.Sprintf("You reached your hydration target on %d of the last 7 days. That low baseline can quietly drag recovery, appetite, and training quality.", hydrationHitDays),
			fmt.Sprintf("คุณถึงเป้าน้ำเพียง %d จาก 7 วันล่าสุด ซึ่งเป็นฐานที่ต่ำพอจะฉุดทั้งการฟื้นตัว ความอยากอาหาร และคุณภาพการซ้อมแบบไม่รู้ตัว", hydrationHitDays),
		)
		prompt = briefCopy(
			lang,
			fmt.Sprintf("Review my last 7 days and help me fix hydration consistency. I only hit my water target on %d of 7 days. Give me a realistic hydration routine.", hydrationHitDays),
			fmt.Sprintf("ช่วยดูข้อมูล 7 วันล่าสุดของฉันและแก้เรื่องความสม่ำเสมอของการดื่มน้ำให้หน่อย ฉันถึงเป้าน้ำแค่ %d จาก 7 วัน ช่วยจัด routine ที่ทำได้จริงให้ด้วย", hydrationHitDays),
		)
	case weekendDelta >= 12:
		title = briefCopy(lang, "Weekend intake is shaping the whole trend", "แคลอรี่ช่วงสุดสัปดาห์กำลังดึงแนวโน้มทั้งสัปดาห์")
		summary = briefCopy(
			lang,
			fmt.Sprintf("Weekend calorie intake is running about %s%% above weekdays, which is large enough to blur the progress from the rest of the week.", briefNumber(weekendDelta)),
			fmt.Sprintf("แคลอรี่ช่วงสุดสัปดาห์สูงกว่าวันธรรมดาราว %s%% มากพอที่จะกลบความคืบหน้าที่ทำไว้ในวันอื่นของสัปดาห์", briefNumber(weekendDelta)),
		)
		prompt = briefCopy(
			lang,
			fmt.Sprintf("Analyze my last 7 days. My weekend calorie intake is about %s%% above weekdays. Help me reduce that without making my weekends miserable.", briefNumber(weekendDelta)),
			fmt.Sprintf("ช่วยวิเคราะห์ 7 วันล่าสุดของฉัน ตอนนี้แคลอรี่ช่วงสุดสัปดาห์สูงกว่าวันธรรมดาประมาณ %s%% ช่วยหาวิธีลดลงโดยไม่ทำให้ weekend เครียดเกินไป", briefNumber(weekendDelta)),
		)
	case avgSleep < 7:
		title = briefCopy(lang, "Recovery is the bottleneck this week", "การฟื้นตัวคือคอขวดของสัปดาห์นี้")
		summary = briefCopy(
			lang,
			fmt.Sprintf("Average sleep is only %s hours over the last 7 days. Even solid nutrition will feel harder to sustain when recovery stays that low.", briefNumber(avgSleep)),
			fmt.Sprintf("ค่าเฉลี่ยการนอนใน 7 วันล่าสุดอยู่ที่เพียง %s ชั่วโมง ต่อให้โภชนาการดี ก็ยังรักษาได้ยากถ้าการฟื้นตัวยังต่ำแบบนี้", briefNumber(avgSleep)),
		)
		prompt = briefCopy(
			lang,
			fmt.Sprintf("Review my last 7 days and help me improve recovery. My average sleep is %s hours. Suggest the smallest changes with the biggest impact.", briefNumber(avgSleep)),
			fmt.Sprintf("ช่วยวิเคราะห์ 7 วันล่าสุดของฉันและหาวิธีเพิ่มการฟื้นตัวให้หน่อย ตอนนี้ฉันนอนเฉลี่ย %s ชั่วโมง ช่วยแนะนำการเปลี่ยนแปลงเล็ก ๆ ที่คุ้มที่สุด", briefNumber(avgSleep)),
		)
	default:
		title = briefCopy(lang, "The week is stable enough to level up", "สัปดาห์นี้นิ่งพอที่จะขยับไปอีกขั้น")
		summary = briefCopy(
			lang,
			fmt.Sprintf("You stayed active on %d of the last 7 days, and the main opportunity now is tightening consistency rather than fixing a major leak.", activeDays),
			fmt.Sprintf("คุณมีการขยับร่างกายใน %d จาก 7 วันล่าสุด ตอนนี้โอกาสที่ดีที่สุดคือเก็บความสม่ำเสมอให้แน่นขึ้น มากกว่าการแก้รอยรั่วใหญ่", activeDays),
		)
		prompt = briefCopy(
			lang,
			"Review my last 7 days and tell me the one habit I should tighten next week to improve fastest.",
			"ช่วยดูข้อมูล 7 วันล่าสุดของฉัน แล้วบอกนิสัยเดียวที่ฉันควรเก็บให้แน่นขึ้นในสัปดาห์หน้าเพื่อให้พัฒนาเร็วที่สุด",
		)
	}

	return SevenDayInsight{
		Eyebrow: briefCopy(lang, "7-day signal", "สัญญาณจาก 7 วันล่าสุด"),
		Title:   title,
		Summary: summary,
		Stats: []SevenDayInsightStat{
			{
				Label: briefCopy(lang, "Protein target", "ถึงเป้าโปรตีน"),
				Value: fmt.Sprintf("%d/7", proteinHitDays),
				Tone:  "protein",
			},
			{
				Label: briefCopy(lang, "Hydration target", "ถึงเป้าน้ำ"),
				Value: fmt.Sprintf("%d/7", hydrationHitDays),
				Tone:  "water",
			},
			{
				Label: briefCopy(lang, "Avg sleep", "นอนเฉลี่ย"),
				Value: fmt.Sprintf("%s h", briefNumber(avgSleep)),
				Tone:  "recovery",
			},
			{
				Label: briefCopy(lang, "Active days", "วันที่ขยับ"),
				Value: fmt.Sprintf("%d/7", activeDays),
				Tone:  "training",
			},
		},
		CtaLabel: briefCopy(lang, "Ask AI to break this down", "ให้ AI แตก insight นี้ต่อ"),
		Prompt:   prompt,
	}
}

func briefPercent(value, goal float64) float64 {
	if goal <= 0 {
		return 0
	}
	return math.Max(0, math.Min(100, (value/goal)*100))
}

func briefCopy(lang, en, th string) string {
	if lang == "en" {
		return en
	}
	return th
}

func briefNumber(value float64) string {
	rounded := math.Round(value*10) / 10
	if math.Abs(rounded-math.Round(rounded)) < 0.05 {
		return fmt.Sprintf("%.0f", math.Round(rounded))
	}
	return fmt.Sprintf("%.1f", rounded)
}
