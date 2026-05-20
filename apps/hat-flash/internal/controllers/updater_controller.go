package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type UpdaterController struct {
	updater *services.UpdaterService
}

func NewUpdaterController(updater *services.UpdaterService) *UpdaterController {
	return &UpdaterController{updater: updater}
}

func (c *UpdaterController) Check() (models.UpdateStatus, error) {
	return c.updater.Check()
}
