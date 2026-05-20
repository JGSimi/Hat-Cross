package models

type AIMode string

const (
	AIModeHat    AIMode = "hat"
	AIModeHatPro AIMode = "hat-pro"
)

type ConversationTurn struct {
	Role        string   `json:"role"`
	TextContent string   `json:"textContent"`
	Images      []string `json:"images,omitempty"`
}

type ChatStreamRequest struct {
	StreamID        int64              `json:"streamId"`
	Messages        []ConversationTurn `json:"messages"`
	SystemPrompt    string             `json:"systemPrompt"`
	Mode            AIMode             `json:"mode"`
	Temperature     float64            `json:"temperature"`
	MaxTokens       uint32             `json:"maxTokens"`
	Images          []string           `json:"images,omitempty"`
	RoomID          *string            `json:"roomId,omitempty"`
	RoomShare       bool               `json:"roomShare"`
	SourceMessageID *string            `json:"sourceMessageId,omitempty"`
	IDToken         string             `json:"idToken,omitempty"`
	IdempotencyKey  string             `json:"idempotencyKey,omitempty"`
}

type StreamChunk struct {
	StreamID     int64   `json:"streamId"`
	Text         string  `json:"text"`
	IsFinished   bool    `json:"isFinished"`
	InputTokens  *uint32 `json:"inputTokens"`
	OutputTokens *uint32 `json:"outputTokens"`
	ContentType  string  `json:"contentType"`
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}
