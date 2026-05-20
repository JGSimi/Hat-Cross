package controllers

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"

type SessionController struct {
	session *services.SessionService
}

func NewSessionController(session *services.SessionService) *SessionController {
	return &SessionController{session: session}
}

func (c *SessionController) SetIDToken(token string) error {
	return c.session.SetIDToken(token)
}

func (c *SessionController) Clear() {
	c.session.Clear()
}
