package services

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"

type UpdaterService struct{}

func NewUpdaterService() *UpdaterService {
	return &UpdaterService{}
}

func (s *UpdaterService) Check() (models.UpdateStatus, error) {
	return models.UpdateStatus{
		Available: false,
		Message:   "GitHub Releases updater hook ready; no update provider configured in local dev.",
	}, nil
}
