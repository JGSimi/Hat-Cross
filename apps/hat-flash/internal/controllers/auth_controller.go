package controllers

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
)

type AuthController struct {
	auth *services.AuthService
}

func NewAuthController(auth *services.AuthService) *AuthController {
	return &AuthController{auth: auth}
}

func (c *AuthController) RunGoogleLoopbackFlow(clientID string, state string, codeChallenge string) (models.OAuthFlowResult, error) {
	return c.auth.RunGoogleLoopbackFlow(clientID, state, codeChallenge)
}
