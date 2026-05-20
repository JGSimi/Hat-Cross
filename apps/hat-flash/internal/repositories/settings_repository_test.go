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
	settings.Shortcuts.Clipboard = "CommandOrControl+Shift+Y"

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
	if got.Shortcuts.Clipboard != "CommandOrControl+Shift+Y" {
		t.Fatalf("clipboard shortcut = %q", got.Shortcuts.Clipboard)
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
