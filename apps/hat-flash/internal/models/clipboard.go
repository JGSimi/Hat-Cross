package models

type ClipboardImage struct {
	MimeType string `json:"mimeType"`
	DataURL  string `json:"dataUrl"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

type ClipboardPayload struct {
	Text  string          `json:"text"`
	Image *ClipboardImage `json:"image,omitempty"`
}
