package controllers

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"

type PopoverController struct {
	windows *services.WindowService
}

func NewPopoverController(windows *services.WindowService) *PopoverController {
	return &PopoverController{windows: windows}
}

func (c *PopoverController) Toggle() {
	c.windows.TogglePopover()
}
