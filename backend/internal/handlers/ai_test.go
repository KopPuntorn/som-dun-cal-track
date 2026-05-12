package handlers

import (
	"strings"
	"testing"
)

func TestNormalizeChatLanguage(t *testing.T) {
	if got := normalizeChatLanguage(" EN "); got != "en" {
		t.Fatalf("normalizeChatLanguage returned %q, want en", got)
	}
	if got := normalizeChatLanguage("th"); got != "th" {
		t.Fatalf("normalizeChatLanguage returned %q, want th", got)
	}
	if got := normalizeChatLanguage("ja"); got != "th" {
		t.Fatalf("normalizeChatLanguage returned %q, want th fallback", got)
	}
}

func TestResponseUsesUnexpectedScript(t *testing.T) {
	tests := []struct {
		name    string
		content string
		lang    string
		want    bool
	}{
		{name: "thai allows thai and common latin units", content: "วันนี้โปรตีน +20g kcal", lang: "th", want: false},
		{name: "thai rejects japanese", content: "今日はโปรตีน", lang: "th", want: true},
		{name: "english rejects thai", content: "Protein วันนี้", lang: "en", want: true},
		{name: "english allows ascii", content: "Protein +20g, 300 kcal.", lang: "en", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := responseUsesUnexpectedScript(tt.content, tt.lang); got != tt.want {
				t.Fatalf("responseUsesUnexpectedScript(%q, %q) = %v, want %v", tt.content, tt.lang, got, tt.want)
			}
		})
	}
}

func TestCollectStreamedContent(t *testing.T) {
	stream := strings.NewReader(strings.Join([]string{
		`data: {"choices":[{"delta":{"content":"Hello "}}]}`,
		`data: {"choices":[{"delta":{"reasoning":"hidden","content":"world"}}]}`,
		`data: not-json`,
		`data: [DONE]`,
	}, "\n"))

	got, err := collectStreamedContent(stream)
	if err != nil {
		t.Fatalf("collectStreamedContent returned error: %v", err)
	}

	want := "Hello <think>hidden</think>world"
	if got != want {
		t.Fatalf("collectStreamedContent = %q, want %q", got, want)
	}
}

func TestFallbackText(t *testing.T) {
	if got := fallbackText("  pescatarian  ", "none"); got != "pescatarian" {
		t.Fatalf("fallbackText returned %q, want trimmed value", got)
	}
	if got := fallbackText("   ", "none"); got != "none" {
		t.Fatalf("fallbackText returned %q, want fallback", got)
	}
}
