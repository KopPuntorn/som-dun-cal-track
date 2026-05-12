package handlers

import (
	"strings"
	"testing"
	"time"

	"backend/internal/models"
)

func floatPtr(value float64) *float64 {
	return &value
}

func TestNormalizeDashboardLanguage(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "english", in: "en", want: "en"},
		{name: "english with spaces", in: " EN ", want: "en"},
		{name: "thai default", in: "th", want: "th"},
		{name: "unknown defaults thai", in: "jp", want: "th"},
		{name: "empty defaults thai", in: "", want: "th"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeDashboardLanguage(tt.in); got != tt.want {
				t.Fatalf("normalizeDashboardLanguage(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestBuildDailyBriefStartState(t *testing.T) {
	brief := buildDailyBrief(DashboardSummary{
		Goals: models.Goals{
			Calories:            1800,
			Protein:             120,
			ExerciseMinutesGoal: 30,
		},
	}, "en")

	if brief.FocusValue != "Log the first win" {
		t.Fatalf("FocusValue = %q, want start guidance", brief.FocusValue)
	}
	if brief.MomentumValue != "0%" {
		t.Fatalf("MomentumValue = %q, want 0%%", brief.MomentumValue)
	}
	if len(brief.Signals) != 4 {
		t.Fatalf("Signals len = %d, want 4", len(brief.Signals))
	}
	if len(brief.Actions) != 2 || brief.Actions[1].Variant != "primary" {
		t.Fatalf("Actions = %#v, want secondary analysis plus primary start action", brief.Actions)
	}
}

func TestBuildDailyBriefChoosesProteinGap(t *testing.T) {
	brief := buildDailyBrief(DashboardSummary{
		Goals: models.Goals{
			Calories:            2000,
			Protein:             150,
			ExerciseMinutesGoal: 30,
		},
		TodayFoods: []models.Food{
			{Calories: 1950, Protein: floatPtr(40)},
		},
		WaterToday: models.WaterIntake{Glasses: 8},
		Exercise: []models.ExerciseRecord{
			{DurationMinutes: 35},
		},
		Sleep: []models.SleepRecord{
			{DurationHours: 8, Date: time.Now()},
		},
	}, "en")

	if brief.FocusValue != "+110g protein" {
		t.Fatalf("FocusValue = %q, want protein gap", brief.FocusValue)
	}
	if !strings.Contains(brief.Title, "Protein") {
		t.Fatalf("Title = %q, want protein-focused title", brief.Title)
	}
}

func TestBuildDailyBriefThaiCopyIsValidUTF8Thai(t *testing.T) {
	brief := buildDailyBrief(DashboardSummary{}, "th")

	joined := brief.Eyebrow + brief.Title + brief.Summary + brief.FocusLabel + brief.FocusValue
	for _, signal := range brief.Signals {
		joined += signal.Label + signal.Value
	}
	for _, action := range brief.Actions {
		joined += action.Label + action.Prompt
	}

	if strings.ContainsAny(joined, "àâð") {
		t.Fatalf("Thai copy appears mojibaked: %q", joined)
	}
	if !strings.Contains(joined, "วัน") {
		t.Fatalf("Thai copy did not contain expected Thai text: %q", joined)
	}
}

func TestBuildSevenDayInsightProteinGap(t *testing.T) {
	now := time.Now().In(time.Local)
	foods := []models.Food{
		{Date: now.AddDate(0, 0, -1), Calories: 600, Protein: floatPtr(120)},
		{Date: now.AddDate(0, 0, -2), Calories: 650, Protein: floatPtr(130)},
	}

	insight := buildSevenDayInsight(
		models.Goals{Protein: 100, ExerciseMinutesGoal: 30},
		foods,
		nil,
		nil,
		nil,
		"en",
	)

	if !strings.Contains(insight.Title, "Protein consistency") {
		t.Fatalf("Title = %q, want protein consistency insight", insight.Title)
	}
	if insight.Stats[0].Value != "2/7" {
		t.Fatalf("protein stat = %q, want 2/7", insight.Stats[0].Value)
	}
	if insight.CtaLabel == "" || insight.Prompt == "" {
		t.Fatalf("expected CTA and prompt to be populated: %#v", insight)
	}
}

func TestBriefNumberFormatting(t *testing.T) {
	tests := []struct {
		value float64
		want  string
	}{
		{value: 12, want: "12"},
		{value: 12.04, want: "12"},
		{value: 12.15, want: "12.2"},
		{value: 0, want: "0"},
	}

	for _, tt := range tests {
		if got := briefNumber(tt.value); got != tt.want {
			t.Fatalf("briefNumber(%v) = %q, want %q", tt.value, got, tt.want)
		}
	}
}
