package services

import (
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type WindowService struct {
	windows map[string]application.Window
	events  EventBus
}

func NewWindowService(events EventBus) *WindowService {
	return &WindowService{windows: map[string]application.Window{}, events: events}
}

func (s *WindowService) SetWindow(name string, window application.Window) {
	s.windows[name] = window
}

func (s *WindowService) ShowFlash(payload models.FlashPayload) {
	if window := s.windows["flash"]; window != nil {
		window.SetPosition(payload.Position.X, payload.Position.Y)
		window.Show()
	}
	if s.events != nil {
		s.events.Emit(models.EventFlashShow, payload)
		s.events.Emit("flash-show", payload)
	}
}

func (s *WindowService) HideFlash() {
	if window := s.windows["flash"]; window != nil {
		window.Hide()
	}
	if s.events != nil {
		s.events.Emit(models.EventFlashHide, nil)
	}
}
