package services

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/repositories"
)

type SettingsService struct {
	repo   *repositories.SettingsRepository
	events EventBus
}

func NewSettingsService(repo *repositories.SettingsRepository, events EventBus) *SettingsService {
	return &SettingsService{repo: repo, events: events}
}

func (s *SettingsService) Get() (models.Settings, error) {
	return s.repo.Get()
}

func (s *SettingsService) Save(settings models.Settings) error {
	if err := s.repo.Save(settings); err != nil {
		return err
	}
	if s.events != nil {
		s.events.Emit(models.EventSettingsChanged, settings)
	}
	return nil
}
