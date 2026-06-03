package repositories

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

func TestSettingsRepositoryRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	repo := NewSettingsRepository(path)

	settings := models.DefaultSettings()
	settings.Mode = models.AIModeHatPro
	settings.Shortcuts.ProcessClipboardFlash = "CommandOrControl+Shift+Y"

	if err := repo.Save(settings); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Mode != models.AIModeHatPro {
		t.Fatalf("mode = %q", got.Mode)
	}
	if got.Shortcuts.ProcessClipboardFlash != "CommandOrControl+Shift+Y" {
		t.Fatalf("clipboard shortcut = %q", got.Shortcuts.ProcessClipboardFlash)
	}
	if !got.Clipboard.Flash.Enabled {
		t.Fatalf("flash should default enabled")
	}
	if got.Clipboard.Flash.Appearance.Opacity < 86 {
		t.Fatalf("flash opacity should default to readable value, got %d", got.Clipboard.Flash.Appearance.Opacity)
	}
}

func TestSettingsRepositoryMissingFileReturnsDefaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "settings.json")
	repo := NewSettingsRepository(path)
	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Mode != models.AIModeHat {
		t.Fatalf("default mode = %q", got.Mode)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("missing file was unexpectedly created")
	}
}

func TestSettingsRepositoryMigratesLegacyShortcut(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"shortcuts":{"clipboard":"CommandOrControl+Shift+Y"}}`), 0o600); err != nil {
		t.Fatalf("write legacy settings: %v", err)
	}
	repo := NewSettingsRepository(path)

	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Shortcuts.ProcessClipboardFlash != "CommandOrControl+Shift+Y" {
		t.Fatalf("migrated shortcut = %q", got.Shortcuts.ProcessClipboardFlash)
	}
	if got.Shortcuts.AdjustFlashPosition != "CommandOrControl+Alt+F" {
		t.Fatalf("adjust shortcut = %q", got.Shortcuts.AdjustFlashPosition)
	}
}

func TestSettingsRepositoryRepairsLegacyFlashShortcutConflict(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	raw := `{"shortcuts":{"processClipboardFlash":"CommandOrControl+Shift+X","adjustFlashPosition":"CommandOrControl+Shift+F","emergencyQuit":"CommandOrControl+Shift+B"}}`
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}
	repo := NewSettingsRepository(path)

	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Shortcuts.ProcessClipboardFlash != "CommandOrControl+Shift+F" {
		t.Fatalf("process shortcut = %q", got.Shortcuts.ProcessClipboardFlash)
	}
	if got.Shortcuts.AdjustFlashPosition != "CommandOrControl+Alt+F" {
		t.Fatalf("adjust shortcut = %q", got.Shortcuts.AdjustFlashPosition)
	}
}

func TestSettingsRepositoryRepairsLegacyInvisibleFlashSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	raw := `{"clipboard":{"flash":{"enabled":false,"appearance":{"opacity":35,"fontSizePx":14}}}}`
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}
	repo := NewSettingsRepository(path)

	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if !got.Clipboard.Flash.Enabled {
		t.Fatalf("legacy invisible flash should be re-enabled")
	}
	if got.Clipboard.Flash.Appearance.Opacity < 86 {
		t.Fatalf("flash opacity should be readable, got %d", got.Clipboard.Flash.Appearance.Opacity)
	}
}

func TestSettingsRepositoryPersistsRepairedLegacyInvisibleFlashSettings(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	raw := `{"clipboard":{"flash":{"enabled":false,"appearance":{"opacity":35,"fontSizePx":14}}}}`
	if err := os.WriteFile(path, []byte(raw), 0o600); err != nil {
		t.Fatalf("write settings: %v", err)
	}
	repo := NewSettingsRepository(path)

	if _, err := repo.Get(); err != nil {
		t.Fatalf("get: %v", err)
	}
	got, err := repo.Get()
	if err != nil {
		t.Fatalf("get repaired: %v", err)
	}
	if !got.Clipboard.Flash.Enabled {
		t.Fatalf("persisted legacy flash should be enabled")
	}
	if got.Clipboard.Flash.Appearance.Opacity < 86 {
		t.Fatalf("persisted flash opacity should be readable, got %d", got.Clipboard.Flash.Appearance.Opacity)
	}
}
