package services

import (
	"testing"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

func TestHideFlashEmitsVoidEvent(t *testing.T) {
	events := &MemoryEventBus{}
	service := NewWindowService(events)

	service.HideFlash()

	if len(events.Events) != 1 {
		t.Fatalf("events = %#v", events.Events)
	}
	event := events.Events[0]
	if event.Name != models.EventFlashHide {
		t.Fatalf("event name = %q", event.Name)
	}
	if len(event.Data) != 0 {
		t.Fatalf("flash hide event should not carry nil payload: %#v", event.Data)
	}
}
