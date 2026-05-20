package services

import "testing"

type fakeClipboard struct {
	text string
	ok   bool
}

func (f *fakeClipboard) Text() (string, bool) {
	return f.text, f.ok
}

func (f *fakeClipboard) SetText(text string) bool {
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
}
