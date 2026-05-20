package services

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

const DefaultHatProxyChatURL = "https://hat-proxy.joao02simi.workers.dev/v1/chat"

type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

type ChatService struct {
	client   HTTPClient
	session  *SessionService
	events   EventBus
	endpoint string

	mu      sync.Mutex
	cancels map[int64]context.CancelFunc
}

func NewChatService(client HTTPClient, session *SessionService, events EventBus, endpoint string) *ChatService {
	if client == nil {
		client = http.DefaultClient
	}
	if endpoint == "" {
		endpoint = DefaultHatProxyChatURL
	}
	return &ChatService{
		client:   client,
		session:  session,
		events:   events,
		endpoint: endpoint,
		cancels:  map[int64]context.CancelFunc{},
	}
}

func (s *ChatService) Stream(ctx context.Context, request models.ChatStreamRequest) error {
	if request.StreamID == 0 {
		request.StreamID = 1
	}
	if request.Mode == "" {
		request.Mode = models.AIModeHat
	}
	if request.Temperature == 0 {
		request.Temperature = 0.7
	}
	if request.MaxTokens == 0 {
		request.MaxTokens = 4096
	}
	if request.IdempotencyKey == "" {
		request.IdempotencyKey = randomID()
	}

	token := strings.TrimSpace(request.IDToken)
	if token == "" {
		var err error
		token, err = s.session.RequireIDToken()
		if err != nil {
			return err
		}
	}

	streamCtx, cancel := context.WithCancel(ctx)
	s.registerCancel(request.StreamID, cancel)
	defer s.unregisterCancel(request.StreamID)

	body, err := json.Marshal(s.proxyBody(request))
	if err != nil {
		return err
	}
	httpReq, err := http.NewRequestWithContext(streamCtx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+token)
	httpReq.Header.Set("Idempotency-Key", request.IdempotencyKey)

	response, err := s.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("connect Hat proxy: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		bytes, _ := io.ReadAll(response.Body)
		return fmt.Errorf("%s", mapHatProxyError(response.StatusCode, string(bytes)))
	}

	if err := s.consumeSSE(request.StreamID, response.Body); err != nil {
		return err
	}
	s.emitDone(request.StreamID)
	return nil
}

func (s *ChatService) Cancel(streamID int64) {
	s.mu.Lock()
	cancel := s.cancels[streamID]
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

func (s *ChatService) proxyBody(request models.ChatStreamRequest) map[string]any {
	apiMessages := make([]models.ChatMessage, 0, len(request.Messages))
	for i, turn := range request.Messages {
		combinedImages := append([]string{}, turn.Images...)
		if i == len(request.Messages)-1 {
			combinedImages = append(combinedImages, request.Images...)
		}
		if len(combinedImages) == 0 {
			apiMessages = append(apiMessages, models.ChatMessage{Role: turn.Role, Content: turn.TextContent})
			continue
		}

		parts := make([]map[string]any, 0, len(combinedImages)+1)
		for _, img := range combinedImages {
			url := img
			if !strings.HasPrefix(url, "data:") {
				url = "data:image/png;base64," + url
			}
			parts = append(parts, map[string]any{
				"type":      "image_url",
				"image_url": map[string]any{"url": url},
			})
		}
		parts = append(parts, map[string]any{"type": "text", "text": turn.TextContent})
		apiMessages = append(apiMessages, models.ChatMessage{Role: turn.Role, Content: parts})
	}

	body := map[string]any{
		"mode":         request.Mode,
		"messages":     apiMessages,
		"systemPrompt": request.SystemPrompt,
		"temperature":  request.Temperature,
		"maxTokens":    request.MaxTokens,
	}
	if request.RoomShare {
		body["roomShare"] = true
	}
	if request.RoomID != nil && *request.RoomID != "" {
		body["roomId"] = *request.RoomID
	}
	if request.SourceMessageID != nil && *request.SourceMessageID != "" {
		body["sourceMessageId"] = *request.SourceMessageID
	}
	return body
}

func (s *ChatService) consumeSSE(streamID int64, reader io.Reader) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)
	inThoughtsBlock := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		data, ok := strings.CutPrefix(line, "data:")
		if !ok {
			continue
		}
		data = strings.TrimSpace(data)
		if data == "[DONE]" {
			return nil
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(data), &payload); err != nil {
			continue
		}
		s.emitOpenAIChunk(streamID, payload, &inThoughtsBlock)
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return nil
}

func (s *ChatService) emitOpenAIChunk(streamID int64, payload map[string]any, inThoughtsBlock *bool) {
	delta := firstChoiceDelta(payload)
	if content, ok := delta["content"].(string); ok && content != "" {
		s.emitContent(streamID, content, inThoughtsBlock)
	}
	if reasoning, ok := delta["reasoning_content"].(string); ok && reasoning != "" {
		s.emitChunk(models.StreamChunk{StreamID: streamID, Text: reasoning, ContentType: "thinking"})
	}
	if usage, ok := payload["usage"].(map[string]any); ok {
		input := numberToUint32Ptr(usage["prompt_tokens"])
		output := numberToUint32Ptr(usage["completion_tokens"])
		if input != nil || output != nil {
			s.emitChunk(models.StreamChunk{
				StreamID:     streamID,
				InputTokens:  input,
				OutputTokens: output,
				ContentType:  "text",
			})
		}
	}
}

func (s *ChatService) emitContent(streamID int64, content string, inThoughtsBlock *bool) {
	remaining := content
	for remaining != "" {
		if *inThoughtsBlock {
			if end := strings.Index(remaining, "</thoughts>"); end >= 0 {
				if before := remaining[:end]; before != "" {
					s.emitChunk(models.StreamChunk{StreamID: streamID, Text: before, ContentType: "thinking"})
				}
				*inThoughtsBlock = false
				remaining = remaining[end+len("</thoughts>"):]
				continue
			}
			s.emitChunk(models.StreamChunk{StreamID: streamID, Text: remaining, ContentType: "thinking"})
			return
		}
		if start := strings.Index(remaining, "<thoughts>"); start >= 0 {
			if before := remaining[:start]; before != "" {
				s.emitChunk(models.StreamChunk{StreamID: streamID, Text: before, ContentType: "text"})
			}
			*inThoughtsBlock = true
			remaining = remaining[start+len("<thoughts>"):]
			continue
		}
		s.emitChunk(models.StreamChunk{StreamID: streamID, Text: remaining, ContentType: "text"})
		return
	}
}

func (s *ChatService) emitChunk(chunk models.StreamChunk) {
	if s.events == nil {
		return
	}
	s.events.Emit(models.EventStreamChunk, chunk)
	s.events.Emit("chat-stream", chunk)
}

func (s *ChatService) emitDone(streamID int64) {
	chunk := models.StreamChunk{StreamID: streamID, IsFinished: true, ContentType: "text"}
	s.emitChunk(chunk)
	if s.events != nil {
		s.events.Emit(models.EventStreamDone, map[string]any{"streamId": streamID})
	}
}

func (s *ChatService) registerCancel(streamID int64, cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cancels[streamID] = cancel
}

func (s *ChatService) unregisterCancel(streamID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.cancels, streamID)
}

func firstChoiceDelta(payload map[string]any) map[string]any {
	choices, ok := payload["choices"].([]any)
	if !ok || len(choices) == 0 {
		return map[string]any{}
	}
	choice, ok := choices[0].(map[string]any)
	if !ok {
		return map[string]any{}
	}
	delta, ok := choice["delta"].(map[string]any)
	if !ok {
		return map[string]any{}
	}
	return delta
}

func numberToUint32Ptr(value any) *uint32 {
	switch v := value.(type) {
	case float64:
		n := uint32(v)
		return &n
	case int:
		n := uint32(v)
		return &n
	case uint32:
		return &v
	default:
		return nil
	}
}

func mapHatProxyError(status int, body string) string {
	var parsed map[string]any
	_ = json.Unmarshal([]byte(body), &parsed)
	detail, _ := parsed["error"].(string)
	lower := strings.ToLower(detail)
	if (status == 400 || status == 404) &&
		(strings.Contains(lower, "gemini") || strings.Contains(lower, "model") ||
			strings.Contains(lower, "deprecated") || strings.Contains(lower, "not found") ||
			strings.Contains(lower, "unavailable") || strings.Contains(lower, "invalid argument")) {
		return fmt.Sprintf("error:serverError:%d:upstream-model-unavailable", status)
	}
	switch status {
	case http.StatusUnauthorized:
		return "error:sessionExpired"
	case http.StatusPaymentRequired:
		return "error:insufficientCredits"
	case http.StatusTooManyRequests:
		return "error:rateLimited"
	default:
		if status >= 500 && status <= 599 {
			return fmt.Sprintf("error:serverError:%d:%s", status, detail)
		}
		return fmt.Sprintf("error:unknownError:%d:%s", status, detail)
	}
}

func randomID() string {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "hat-flash"
	}
	return hex.EncodeToString(bytes[:])
}
