package models

type HistoryEntry struct {
	ID        string `json:"id"`
	Kind      string `json:"kind"`
	Prompt    string `json:"prompt"`
	Response  string `json:"response"`
	CreatedAt int64  `json:"createdAt"`
}
