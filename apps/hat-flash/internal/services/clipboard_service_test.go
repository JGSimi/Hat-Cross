package services

import (
	"testing"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

type fakeClipboard struct {
	text      string
	ok        bool
	panicText bool
	panicSet  bool
}

func (f *fakeClipboard) Text() (string, bool) {
	if f.panicText {
		panic("text read panic")
	}
	return f.text, f.ok
}

func (f *fakeClipboard) SetText(text string) bool {
	if f.panicSet {
		panic("text write panic")
	}
	f.text = text
	f.ok = true
	return true
}

func TestClipboardReadWriteText(t *testing.T) {
	clip := &fakeClipboard{ok: true}
	service := NewClipboardService(clip, nil)

	if err := service.WriteText("abc"); err != nil {
		t.Fatalf("WriteText: %v", err)
	}
	got, err := service.ReadText()
	if err != nil {
		t.Fatalf("ReadText: %v", err)
	}
	if got != "abc" {
		t.Fatalf("text = %q", got)
	}
}

func TestClipboardProcessEmitsFailureForEmptyClipboard(t *testing.T) {
	events := &MemoryEventBus{}
	service := NewClipboardService(&fakeClipboard{ok: true}, events)

	if _, err := service.Process(); err == nil {
		t.Fatalf("expected empty clipboard error")
	}
	if len(events.Events) < 2 || events.Events[0].Name != "clipboard:started" || events.Events[1].Name != "clipboard:failed" {
		t.Fatalf("events = %#v", events.Events)
	}
	if got := events.Events[1].Data[0]; got != "clipboard empty" {
		t.Fatalf("failure = %#v", got)
	}
}

func TestClipboardProcessReturnsTextWithoutReadingImage(t *testing.T) {
	service := NewClipboardService(&fakeClipboard{text: "pergunta", ok: true}, nil)
	service.readImage = func() (image *models.ClipboardImage, err error) {
		t.Fatalf("image reader should not run when text clipboard is present")
		return nil, nil
	}

	payload, err := service.Process()
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if payload.Text != "pergunta" || payload.Image != nil {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestClipboardProcessFallsBackToImageWhenTextReadFails(t *testing.T) {
	service := NewClipboardService(&fakeClipboard{ok: false}, nil)
	service.readImage = func() (*models.ClipboardImage, error) {
		return &models.ClipboardImage{MimeType: "image/png", DataURL: "data:image/png;base64,abc", Width: 12, Height: 8}, nil
	}

	payload, err := service.Process()
	if err != nil {
		t.Fatalf("Process: %v", err)
	}
	if payload.Image == nil || payload.Image.DataURL != "data:image/png;base64,abc" {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestClipboardReadImageConvertsPanicToError(t *testing.T) {
	service := NewClipboardService(&fakeClipboard{ok: true}, nil)
	service.readImage = func() (*models.ClipboardImage, error) {
		panic("native clipboard failure")
	}

	if _, err := service.ReadImage(); err == nil {
		t.Fatalf("expected recovered image error")
	}
}

func TestClipboardTextPanicsBecomeErrors(t *testing.T) {
	service := NewClipboardService(&fakeClipboard{panicText: true}, nil)
	if _, err := service.ReadText(); err == nil {
		t.Fatalf("expected recovered read error")
	}

	service = NewClipboardService(&fakeClipboard{panicSet: true}, nil)
	if err := service.WriteText("abc"); err == nil {
		t.Fatalf("expected recovered write error")
	}
}
