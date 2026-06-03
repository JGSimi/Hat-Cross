package services

import (
	"errors"
	"fmt"
	"strings"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

var ErrClipboardImageUnsupported = errors.New("clipboard image unsupported on this platform")

type TextClipboard interface {
	Text() (string, bool)
	SetText(text string) bool
}

type ClipboardService struct {
	clipboard TextClipboard
	events    EventBus
	readImage func() (*models.ClipboardImage, error)
}

func NewClipboardService(clipboard TextClipboard, events EventBus) *ClipboardService {
	return &ClipboardService{clipboard: clipboard, events: events, readImage: readClipboardImageNative}
}

func (s *ClipboardService) SetTextClipboard(clipboard TextClipboard) {
	s.clipboard = clipboard
}

func (s *ClipboardService) Process() (models.ClipboardPayload, error) {
	if s.events != nil {
		s.events.Emit(models.EventClipboardStarted, nil)
	}

	text, textErr := s.ReadText()
	if strings.TrimSpace(text) != "" {
		return models.ClipboardPayload{Text: text}, nil
	}

	image, imageErr := s.ReadImage()
	if imageErr != nil {
		err := imageErr
		if errors.Is(imageErr, ErrClipboardImageUnsupported) {
			err = errors.New("clipboard empty")
		} else if textErr != nil {
			err = textErr
		}
		if s.events != nil {
			s.events.Emit(models.EventClipboardFailed, err.Error())
		}
		return models.ClipboardPayload{}, err
	}
	if image == nil {
		err := errors.New("clipboard empty")
		if s.events != nil {
			s.events.Emit(models.EventClipboardFailed, err.Error())
		}
		return models.ClipboardPayload{}, err
	}

	return models.ClipboardPayload{Text: text, Image: image}, nil
}

func (s *ClipboardService) ReadText() (text string, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("clipboard text read failed: %v", recovered)
		}
	}()
	if s.clipboard == nil {
		return "", errors.New("clipboard not ready")
	}
	var ok bool
	if application.Get() == nil {
		text, ok = s.clipboard.Text()
	} else {
		application.InvokeSync(func() {
			text, ok = s.clipboard.Text()
		})
	}
	if !ok {
		return "", errors.New("failed to read clipboard text")
	}
	return text, nil
}

func (s *ClipboardService) WriteText(text string) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("clipboard text write failed: %v", recovered)
		}
	}()
	if s.clipboard == nil {
		return errors.New("clipboard not ready")
	}
	var ok bool
	if application.Get() == nil {
		ok = s.clipboard.SetText(text)
	} else {
		application.InvokeSync(func() {
			ok = s.clipboard.SetText(text)
		})
	}
	if !ok {
		return errors.New("failed to write clipboard text")
	}
	return nil
}

func (s *ClipboardService) ReadImage() (*models.ClipboardImage, error) {
	reader := s.readImage
	if reader == nil {
		reader = readClipboardImageNative
	}
	image, err := safeReadClipboardImage(reader)
	if err != nil {
		return nil, err
	}
	return image, nil
}

func safeReadClipboardImage(reader func() (*models.ClipboardImage, error)) (image *models.ClipboardImage, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = fmt.Errorf("clipboard image read failed: %v", recovered)
		}
	}()
	return reader()
}
