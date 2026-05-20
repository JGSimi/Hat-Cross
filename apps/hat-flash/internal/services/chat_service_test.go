package services

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

func TestChatServiceStreamsOpenAIChunks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer token" {
			t.Fatalf("Authorization = %q", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"content\":\"oi\"}}]}\n\n"))
		_, _ = w.Write([]byte("data: {\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":4},\"choices\":[{\"delta\":{}}]}\n\n"))
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
	}))
	defer server.Close()

	events := &MemoryEventBus{}
	session := NewSessionService(events)
	if err := session.SetIDToken("token"); err != nil {
		t.Fatal(err)
	}
	chat := NewChatService(server.Client(), session, events, server.URL)

	err := chat.Stream(context.Background(), models.ChatStreamRequest{
		StreamID:     99,
		Messages:     []models.ConversationTurn{{Role: "user", TextContent: "ola"}},
		SystemPrompt: "prompt",
		Mode:         models.AIModeHat,
	})
	if err != nil {
		t.Fatalf("Stream: %v", err)
	}

	var sawText, sawUsage, sawDone bool
	for _, event := range events.Events {
		if event.Name != models.EventStreamChunk {
			continue
		}
		chunk := event.Data[0].(models.StreamChunk)
		if chunk.Text == "oi" && chunk.ContentType == "text" {
			sawText = true
		}
		if chunk.InputTokens != nil && *chunk.InputTokens == 3 && chunk.OutputTokens != nil && *chunk.OutputTokens == 4 {
			sawUsage = true
		}
		if chunk.IsFinished {
			sawDone = true
		}
	}
	if !sawText || !sawUsage || !sawDone {
		t.Fatalf("events missing text=%v usage=%v done=%v: %#v", sawText, sawUsage, sawDone, events.Events)
	}
}

func TestChatServiceMapsProxyAuthError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"bad token"}`, http.StatusUnauthorized)
	}))
	defer server.Close()

	session := NewSessionService(nil)
	if err := session.SetIDToken("token"); err != nil {
		t.Fatal(err)
	}
	chat := NewChatService(server.Client(), session, nil, server.URL)

	err := chat.Stream(context.Background(), models.ChatStreamRequest{
		StreamID: 1,
		Messages: []models.ConversationTurn{{Role: "user", TextContent: "ola"}},
	})
	if err == nil || err.Error() != "error:sessionExpired" {
		t.Fatalf("error = %v", err)
	}
}
