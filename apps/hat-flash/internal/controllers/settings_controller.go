package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type SettingsController struct {
	settings *services.SettingsService
}

func NewSettingsController(settings *services.SettingsService) *SettingsController {
	return &SettingsController{settings: settings}
}

func (c *SettingsController) Get() (models.Settings, error) {
	return c.settings.Get()
}

func (c *SettingsController) Save(settings models.Settings) error {
	return c.settings.Save(settings)
}
