package repositories

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

type SettingsRepository struct {
	path string
}

func DefaultSettingsPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "HatFlash", "settings.json"), nil
}

func NewSettingsRepository(path string) *SettingsRepository {
	return &SettingsRepository{path: path}
}

func (r *SettingsRepository) Get() (models.Settings, error) {
	defaults := models.DefaultSettings()
	bytes, err := os.ReadFile(r.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return defaults, nil
		}
		return defaults, err
	}

	var loaded models.Settings
	if err := json.Unmarshal(bytes, &loaded); err != nil {
		return defaults, err
	}
	return normalizeSettings(loaded), nil
}

func (r *SettingsRepository) Save(settings models.Settings) error {
	normalized := normalizeSettings(settings)
	if err := os.MkdirAll(filepath.Dir(r.path), 0o755); err != nil {
		return err
	}
	bytes, err := json.MarshalIndent(normalized, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.path, bytes, 0o600)
}

func normalizeSettings(settings models.Settings) models.Settings {
	defaults := models.DefaultSettings()

	if settings.Mode == "" {
		settings.Mode = defaults.Mode
	}
	if settings.Language == "" {
		settings.Language = defaults.Language
	}
	if settings.SystemPrompt == "" {
		settings.SystemPrompt = defaults.SystemPrompt
	}
	if settings.Temperature == 0 {
		settings.Temperature = defaults.Temperature
	}
	if settings.MaxTokens == 0 {
		settings.MaxTokens = defaults.MaxTokens
	}
	if settings.Shortcuts.ProcessClipboardFlash == "" {
		settings.Shortcuts.ProcessClipboardFlash = defaults.Shortcuts.ProcessClipboardFlash
	}
	if settings.Shortcuts.AdjustFlashPosition == "" {
		settings.Shortcuts.AdjustFlashPosition = defaults.Shortcuts.AdjustFlashPosition
	}
	if settings.Shortcuts.EmergencyQuit == "" {
		settings.Shortcuts.EmergencyQuit = defaults.Shortcuts.EmergencyQuit
	}
	if settings.Shortcuts.ProcessClipboardFlash == "CommandOrControl+Shift+X" &&
		settings.Shortcuts.AdjustFlashPosition == defaults.Shortcuts.ProcessClipboardFlash {
		settings.Shortcuts.ProcessClipboardFlash = defaults.Shortcuts.ProcessClipboardFlash
		settings.Shortcuts.AdjustFlashPosition = defaults.Shortcuts.AdjustFlashPosition
	}
	if settings.Shortcuts.AdjustFlashPosition == settings.Shortcuts.ProcessClipboardFlash ||
		settings.Shortcuts.AdjustFlashPosition == defaults.Shortcuts.ProcessClipboardFlash {
		settings.Shortcuts.AdjustFlashPosition = defaults.Shortcuts.AdjustFlashPosition
	}
	if settings.Clipboard.MaxResponseLength == 0 {
		settings.Clipboard.MaxResponseLength = defaults.Clipboard.MaxResponseLength
	}
	if settings.Clipboard.Flash.PreviewLength == 0 {
		settings.Clipboard.Flash.PreviewLength = defaults.Clipboard.Flash.PreviewLength
	}
	if settings.Clipboard.Flash.Timing.Mode == "" {
		settings.Clipboard.Flash.Timing = defaults.Clipboard.Flash.Timing
	}
	if settings.Clipboard.Flash.Appearance.FontSizePx == 0 {
		settings.Clipboard.Flash.Appearance = defaults.Clipboard.Flash.Appearance
	}
	return settings
}
