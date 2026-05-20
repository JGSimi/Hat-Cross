package services

import (
	"errors"
	"strings"
	"sync"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

var ErrAuthRequired = errors.New("auth required")

type SessionService struct {
	mu      sync.RWMutex
	idToken string
	events  EventBus
}

func NewSessionService(events EventBus) *SessionService {
	return &SessionService{events: events}
}

func (s *SessionService) SetIDToken(token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return errors.New("empty id token")
	}
	s.mu.Lock()
	s.idToken = token
	s.mu.Unlock()
	return nil
}

func (s *SessionService) Clear() {
	s.mu.Lock()
	s.idToken = ""
	s.mu.Unlock()
}

func (s *SessionService) IDToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.idToken
}

func (s *SessionService) RequireIDToken() (string, error) {
	token := s.IDToken()
	if token == "" {
		if s.events != nil {
			s.events.Emit(models.EventAuthRequired, map[string]any{"reason": "missing-id-token"})
		}
		return "", ErrAuthRequired
	}
	return token, nil
}
