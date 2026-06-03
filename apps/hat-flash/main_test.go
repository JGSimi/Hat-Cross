package main

import (
	"testing"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestVoidEventsValidateWithoutPayload(t *testing.T) {
	app := application.New(application.Options{Name: "HatFlashEventValidationTest"})

	for _, eventName := range []string{
		models.EventClipboardStarted,
		models.EventFlashHide,
	} {
		func() {
			defer func() {
				if recovered := recover(); recovered != nil {
					t.Fatalf("%s panicked during Wails event validation: %v", eventName, recovered)
				}
			}()
			app.Event.Emit(eventName)
		}()
	}
}
