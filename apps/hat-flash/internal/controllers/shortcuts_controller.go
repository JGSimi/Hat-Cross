package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type ShortcutsController struct {
	shortcuts *services.ShortcutService
}

func NewShortcutsController(shortcuts *services.ShortcutService) *ShortcutsController {
	return &ShortcutsController{shortcuts: shortcuts}
}

func (c *ShortcutsController) Register(settings models.ShortcutSettings) error {
	return c.shortcuts.Register(settings)
}
