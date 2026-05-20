package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type ClipboardController struct {
	clipboard *services.ClipboardService
}

func NewClipboardController(clipboard *services.ClipboardService) *ClipboardController {
	return &ClipboardController{clipboard: clipboard}
}

func (c *ClipboardController) Process() (models.ClipboardPayload, error) {
	return c.clipboard.Process()
}

func (c *ClipboardController) ReadText() (string, error) {
	return c.clipboard.ReadText()
}

func (c *ClipboardController) ReadImage() (*models.ClipboardImage, error) {
	return c.clipboard.ReadImage()
}

func (c *ClipboardController) WriteText(text string) error {
	return c.clipboard.WriteText(text)
}
