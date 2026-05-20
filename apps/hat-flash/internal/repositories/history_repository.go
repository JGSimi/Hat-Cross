package repositories

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

type HistoryRepository struct {
	path string
}

func DefaultHistoryPath() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "HatFlash", "history.json"), nil
}

func NewHistoryRepository(path string) *HistoryRepository {
	return &HistoryRepository{path: path}
}

func (r *HistoryRepository) List() ([]models.HistoryEntry, error) {
	bytes, err := os.ReadFile(r.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []models.HistoryEntry{}, nil
		}
		return nil, err
	}
	var entries []models.HistoryEntry
	if err := json.Unmarshal(bytes, &entries); err != nil {
		return nil, err
	}
	return entries, nil
}

func (r *HistoryRepository) Add(entry models.HistoryEntry, limit int) error {
	entries, err := r.List()
	if err != nil {
		return err
	}
	entries = append([]models.HistoryEntry{entry}, entries...)
	if limit > 0 && len(entries) > limit {
		entries = entries[:limit]
	}
	if err := os.MkdirAll(filepath.Dir(r.path), 0o755); err != nil {
		return err
	}
	bytes, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(r.path, bytes, 0o600)
}
