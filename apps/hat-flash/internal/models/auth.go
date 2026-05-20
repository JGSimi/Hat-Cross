package models

type OAuthFlowResult struct {
	Code        string `json:"code"`
	RedirectURI string `json:"redirectUri"`
}
