package services

import (
	"sync"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type WindowService struct {
	mu           sync.RWMutex
	windows      map[string]application.Window
	events       EventBus
	currentFlash *models.FlashPayload
}

func NewWindowService(events EventBus) *WindowService {
	return &WindowService{windows: map[string]application.Window{}, events: events}
}

func (s *WindowService) SetWindow(name string, window application.Window) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.windows[name] = window
}

func (s *WindowService) ShowFlash(payload models.FlashPayload) {
	s.mu.Lock()
	s.currentFlash = &payload
	window := s.windows["flash"]
	s.mu.Unlock()

	if s.events != nil {
		s.events.Emit(models.EventFlashShow, payload)
	}
	if window != nil {
		window.SetPosition(payload.Position.X, payload.Position.Y)
		window.Show()
		window.EmitEvent(models.EventFlashShow, payload)
	}
}

func (s *WindowService) CurrentFlash() *models.FlashPayload {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.currentFlash == nil {
		return nil
	}
	payload := *s.currentFlash
	return &payload
}

func (s *WindowService) HideFlash() {
	s.mu.Lock()
	s.currentFlash = nil
	window := s.windows["flash"]
	s.mu.Unlock()

	if window != nil {
		window.Hide()
	}
	if s.events != nil {
		s.events.Emit(models.EventFlashHide)
	}
}
