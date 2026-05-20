package models

type FlashPayload struct {
	Text       string          `json:"text"`
	Position   FlashPosition   `json:"position"`
	Timing     FlashTiming     `json:"timing"`
	Appearance FlashAppearance `json:"appearance"`
	StreamID   int64           `json:"streamId"`
}
