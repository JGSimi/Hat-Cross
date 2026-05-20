package services

import (
	"errors"
	"strings"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

var ErrClipboardImageUnsupported = errors.New("clipboard image unsupported on this platform")

type TextClipboard interface {
	Text() (string, bool)
	SetText(text string) bool
}

type ClipboardService struct {
	clipboard TextClipboard
	events    EventBus
}

func NewClipboardService(clipboard TextClipboard, events EventBus) *ClipboardService {
	return &ClipboardService{clipboard: clipboard, events: events}
}

func (s *ClipboardService) SetTextClipboard(clipboard TextClipboard) {
	s.clipboard = clipboard
}

func (s *ClipboardService) Process() (models.ClipboardPayload, error) {
	if s.events != nil {
		s.events.Emit(models.EventClipboardStarted, nil)
	}

	text, textErr := s.ReadText()
	image, imageErr := s.ReadImage()
	if textErr != nil && imageErr != nil {
		if s.events != nil {
			s.events.Emit(models.EventClipboardFailed, textErr.Error())
		}
		return models.ClipboardPayload{}, textErr
	}
	if strings.TrimSpace(text) == "" && image == nil {
		err := errors.New("clipboard empty")
		if s.events != nil {
			s.events.Emit(models.EventClipboardFailed, err.Error())
		}
		return models.ClipboardPayload{}, err
	}

	return models.ClipboardPayload{Text: text, Image: image}, nil
}

func (s *ClipboardService) ReadText() (string, error) {
	if s.clipboard == nil {
		return "", errors.New("clipboard not ready")
	}
	text, ok := s.clipboard.Text()
	if !ok {
		return "", errors.New("failed to read clipboard text")
	}
	return text, nil
}

func (s *ClipboardService) WriteText(text string) error {
	if s.clipboard == nil {
		return errors.New("clipboard not ready")
	}
	if !s.clipboard.SetText(text) {
		return errors.New("failed to write clipboard text")
	}
	return nil
}

func (s *ClipboardService) ReadImage() (*models.ClipboardImage, error) {
	image, err := readClipboardImageNative()
	if err != nil {
		return nil, err
	}
	return image, nil
}
