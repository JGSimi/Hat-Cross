package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type FlashController struct {
	windows *services.WindowService
}

func NewFlashController(windows *services.WindowService) *FlashController {
	return &FlashController{windows: windows}
}

func (c *FlashController) Show(payload models.FlashPayload) {
	c.windows.ShowFlash(payload)
}

func (c *FlashController) Current() *models.FlashPayload {
	return c.windows.CurrentFlash()
}

func (c *FlashController) Hide() {
	c.windows.HideFlash()
}
