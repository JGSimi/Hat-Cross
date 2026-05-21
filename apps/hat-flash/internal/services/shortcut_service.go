package services

import (
	"sync"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

type ShortcutService struct {
	mu       sync.RWMutex
	settings models.ShortcutSettings
	events   EventBus
	handlers ShortcutHandlers
}

type ShortcutHandlers struct {
	ProcessClipboard func()
	AdjustFlash      func()
	EmergencyQuit    func()
}

func NewShortcutService(events EventBus) *ShortcutService {
	return &ShortcutService{events: events}
}

func (s *ShortcutService) SetHandlers(handlers ShortcutHandlers) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.handlers = handlers
}

func (s *ShortcutService) Register(settings models.ShortcutSettings) error {
	s.mu.Lock()
	s.settings = settings
	handlers := s.handlers
	s.mu.Unlock()
	if err := registerNativeShortcuts(settings, s.events, handlers); err != nil {
		return err
	}
	if s.events != nil {
		s.events.Emit("shortcut:registered", settings)
	}
	return nil
}

func (s *ShortcutService) Current() models.ShortcutSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}
