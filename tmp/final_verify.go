package main

import (
	"fmt"
	"regexp"
	"strings"
)

func main() {
	// Replicating the logic from handlers/ai.go
	thinkRe := regexp.MustCompile("(?s)<think>.*?</think>\\n*")
	mdRe := regexp.MustCompile("(?s)^\\s*```(?:json|markdown)?\\n?(.*?)\\n?```\\s*$")

	testCases := []struct {
		name     string
		input    string
	}{
		{
			name:  "Only Thinking (Reasoning)",
			input: "<think>\nBased on your 75kg weight and 2200kcal goal, you are on track.\n</think>",
		},
		{
			name:  "Thinking + Content",
			input: "<think>Calculating...</think>\n\nYour analysis is ready: You are doing great!",
		},
		{
			name:  "Only Content (No Thinking)",
			input: "Hello! How can I help you today?",
		},
		{
			name:  "Markdown Wrapped Thinking only",
			input: "```markdown\n<think>Thinking inside MD</think>\n```",
		},
	}

	for _, tc := range testCases {
		fmt.Printf("--- Test: %s ---\n", tc.name)
		content := tc.input
		original := content

		// 1. Strip think
		content = thinkRe.ReplaceAllString(content, "")
		content = strings.TrimSpace(content)

		// 2. Fallback
		if content == "" && original != "" {
			content = "💡 *Analysis Insight:*\n\n" + original
		}

		// 3. MD clean
		if matches := mdRe.FindStringSubmatch(content); len(matches) > 1 {
			content = strings.TrimSpace(matches[1])
		}

		fmt.Printf("Final Output: [%s]\n\n", content)
	}
}
