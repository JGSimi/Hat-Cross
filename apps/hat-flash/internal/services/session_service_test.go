package services

import (
	"errors"
	"testing"
)

func TestSessionRequiresIDToken(t *testing.T) {
	events := &MemoryEventBus{}
	session := NewSessionService(events)

	if _, err := session.RequireIDToken(); !errors.Is(err, ErrAuthRequired) {
		t.Fatalf("RequireIDToken error = %v", err)
	}
	if len(events.Events) != 1 || events.Events[0].Name != "auth:required" {
		t.Fatalf("expected auth:required event, got %#v", events.Events)
	}
}

func TestSessionSetIDTokenTrims(t *testing.T) {
	session := NewSessionService(nil)
	if err := session.SetIDToken(" token "); err != nil {
		t.Fatalf("SetIDToken: %v", err)
	}
	if got := session.IDToken(); got != "token" {
		t.Fatalf("token = %q", got)
	}
}
