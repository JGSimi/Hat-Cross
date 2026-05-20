package services

import (
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestAuthRunGoogleLoopbackFlowReturnsCode(t *testing.T) {
	service := NewAuthServiceWithOpener(func(rawURL string) error {
		authURL, err := url.Parse(rawURL)
		if err != nil {
			t.Errorf("parse auth URL: %v", err)
			return err
		}
		redirectURI := authURL.Query().Get("redirect_uri")
		if redirectURI == "" {
			t.Errorf("missing redirect_uri")
			return nil
		}

		go func() {
			callback := redirectURI + "?code=abc123&state=state-1"
			_, _ = http.Get(callback)
		}()
		return nil
	}, 2*time.Second)

	result, err := service.RunGoogleLoopbackFlow("client-id", "state-1", "challenge")
	if err != nil {
		t.Fatalf("RunGoogleLoopbackFlow: %v", err)
	}
	if result.Code != "abc123" {
		t.Fatalf("code = %q", result.Code)
	}
	if !strings.HasPrefix(result.RedirectURI, "http://127.0.0.1:") {
		t.Fatalf("redirect URI = %q", result.RedirectURI)
	}
}

func TestAuthRunGoogleLoopbackFlowRejectsStateMismatch(t *testing.T) {
	service := NewAuthServiceWithOpener(func(rawURL string) error {
		authURL, err := url.Parse(rawURL)
		if err != nil {
			return err
		}
		redirectURI := authURL.Query().Get("redirect_uri")
		go func() {
			_, _ = http.Get(redirectURI + "?code=abc123&state=wrong-state")
		}()
		return nil
	}, 2*time.Second)

	_, err := service.RunGoogleLoopbackFlow("client-id", "state-1", "challenge")
	if err == nil || err.Error() != "OAuth state mismatch" {
		t.Fatalf("expected state mismatch, got %v", err)
	}
}
