package models

import "encoding/json"

type ShortcutSettings struct {
	ProcessClipboardFlash string `json:"processClipboardFlash"`
	AdjustFlashPosition   string `json:"adjustFlashPosition"`
	EmergencyQuit          string `json:"emergencyQuit"`
}

func (s *ShortcutSettings) UnmarshalJSON(data []byte) error {
	type alias ShortcutSettings
	var parsed alias
	var legacy map[string]string
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	if err := json.Unmarshal(data, &legacy); err == nil && parsed.ProcessClipboardFlash == "" {
		parsed.ProcessClipboardFlash = legacy["clipboard"]
	}
	*s = ShortcutSettings(parsed)
	return nil
}

type FlashPosition struct {
	X            int    `json:"x"`
	Y            int    `json:"y"`
	MonitorLabel string `json:"monitorLabel,omitempty"`
}

type FlashTiming struct {
	Mode      string `json:"mode"`
	FadeInMs  int    `json:"fadeInMs"`
	FadeOutMs int    `json:"fadeOutMs"`
	HoldMs    *int   `json:"holdMs"`
}

type FlashAppearance struct {
	Color      string `json:"color"`
	Opacity    int    `json:"opacity"`
	FontSizePx int    `json:"fontSizePx"`
	TextShadow bool   `json:"textShadow"`
}

type FlashSettings struct {
	Enabled       bool            `json:"enabled"`
	PreviewLength int             `json:"previewLength"`
	Position      FlashPosition   `json:"position"`
	Timing        FlashTiming     `json:"timing"`
	Appearance    FlashAppearance `json:"appearance"`
}

type ClipboardSettings struct {
	Enabled                 bool          `json:"enabled"`
	CopyResponseToClipboard bool          `json:"copyResponseToClipboard"`
	MaxResponseLength       int           `json:"maxResponseLength"`
	AppendMode              bool          `json:"appendMode"`
	SoundOnComplete         bool          `json:"soundOnComplete"`
	CaptureImages           bool          `json:"captureImages"`
	Flash                   FlashSettings `json:"flash"`
}

type NotificationSettings struct {
	Enabled                        bool `json:"enabled"`
	ShowProcessingNotification     bool `json:"showProcessingNotification"`
	ShowResponseNotification       bool `json:"showResponseNotification"`
	ShowErrorNotification          bool `json:"showErrorNotification"`
	ShowUpdateNotification         bool `json:"showUpdateNotification"`
	ShowClipboardEmptyNotification bool `json:"showClipboardEmptyNotification"`
}

type TokenUsage struct {
	InputTokens  uint32 `json:"inputTokens"`
	OutputTokens uint32 `json:"outputTokens"`
	TotalTokens  uint32 `json:"totalTokens"`
}

type Settings struct {
	AutoLaunch          bool                 `json:"autoLaunch"`
	Mode                AIMode               `json:"mode"`
	Language            string               `json:"language"`
	SystemPrompt        string               `json:"systemPrompt"`
	Temperature         float64              `json:"temperature"`
	MaxTokens           uint32               `json:"maxTokens"`
	Shortcuts           ShortcutSettings     `json:"shortcuts"`
	TokenStats          TokenUsage           `json:"tokenStats"`
	Clipboard           ClipboardSettings    `json:"clipboard"`
	Notifications       NotificationSettings `json:"notifications"`
	OnboardingCompleted bool                 `json:"onboardingCompleted"`
}

func DefaultSettings() Settings {
	return Settings{
		AutoLaunch:   false,
		Mode:         AIModeHat,
		Language:     "pt-BR",
		SystemPrompt: "Responda em portugues do Brasil, de forma direta e util.",
		Temperature:  0.7,
		MaxTokens:    4096,
		Shortcuts: ShortcutSettings{
			ProcessClipboardFlash: "CommandOrControl+Shift+F",
			AdjustFlashPosition:   "CommandOrControl+Alt+F",
			EmergencyQuit:          "CommandOrControl+Shift+Q",
		},
		Clipboard: ClipboardSettings{
			Enabled:                 true,
			CopyResponseToClipboard: true,
			MaxResponseLength:       4096,
			AppendMode:              false,
			SoundOnComplete:         true,
			CaptureImages:           true,
			Flash: FlashSettings{
				Enabled:       true,
				PreviewLength: 200,
				Position:      FlashPosition{X: 40, Y: 40},
				Timing:        FlashTiming{Mode: "typewriter", FadeInMs: 300, FadeOutMs: 500},
				Appearance:    FlashAppearance{Color: "", Opacity: 35, FontSizePx: 14, TextShadow: true},
			},
		},
		Notifications: NotificationSettings{
			Enabled:                        true,
			ShowProcessingNotification:     true,
			ShowResponseNotification:       true,
			ShowErrorNotification:          true,
			ShowUpdateNotification:         true,
			ShowClipboardEmptyNotification: true,
		},
	}
}
