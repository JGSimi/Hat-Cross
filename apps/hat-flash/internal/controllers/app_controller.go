package controllers

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"

type AppController struct {
	app *services.AppService
}

func NewAppController(app *services.AppService) *AppController {
	return &AppController{app: app}
}

func (c *AppController) Quit() {
	c.app.Quit()
}

func (c *AppController) SetAutostart(enabled bool) error {
	return c.app.SetAutostart(enabled)
}

func (c *AppController) IsAutostartEnabled() (bool, error) {
	return c.app.IsAutostartEnabled()
}
