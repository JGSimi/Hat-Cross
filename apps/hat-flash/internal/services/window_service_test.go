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

func TestShowFlashEmitsPayloadEvent(t *testing.T) {
	events := &MemoryEventBus{}
	service := NewWindowService(events)
	payload := models.FlashPayload{
		Text:       "resposta pronta",
		Position:   models.FlashPosition{X: 40, Y: 40},
		Appearance: models.FlashAppearance{Opacity: 92},
	}

	service.ShowFlash(payload)

	if len(events.Events) < 1 {
		t.Fatalf("events = %#v", events.Events)
	}
	event := events.Events[0]
	if event.Name != models.EventFlashShow {
		t.Fatalf("event name = %q", event.Name)
	}
	got := event.Data[0].(models.FlashPayload)
	if got.Text != payload.Text || got.Appearance.Opacity != 92 {
		t.Fatalf("payload = %#v", got)
	}
}

func TestShowFlashStoresCurrentPayloadUntilHide(t *testing.T) {
	service := NewWindowService(nil)
	payload := models.FlashPayload{
		Text:       "resposta pronta",
		Position:   models.FlashPosition{X: 40, Y: 40},
		Appearance: models.FlashAppearance{Opacity: 92},
	}

	service.ShowFlash(payload)

	got := service.CurrentFlash()
	if got == nil {
		t.Fatalf("current flash payload missing")
	}
	if got.Text != payload.Text || got.Position.X != 40 {
		t.Fatalf("current flash payload = %#v", got)
	}

	got.Text = "mutated"
	if service.CurrentFlash().Text != payload.Text {
		t.Fatalf("current flash payload should be returned as a copy")
	}

	service.HideFlash()
	if service.CurrentFlash() != nil {
		t.Fatalf("current flash payload should be cleared after hide")
	}
}
