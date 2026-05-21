//go:build darwin

package services

import (
	"testing"
	"time"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

func TestParseDarwinShortcutUsesCommandForCommandOrControl(t *testing.T) {
	modifiers, keyCode, err := parseDarwinShortcut("CommandOrControl+Shift+F")
	if err != nil {
		t.Fatalf("parse shortcut: %v", err)
	}
	if keyCode != 0x03 {
		t.Fatalf("keyCode = %#x, want F key code", keyCode)
	}
	if modifiers == 0 {
		t.Fatalf("modifiers should include command and shift")
	}
}

func TestParseDarwinShortcutRejectsUnsupportedKey(t *testing.T) {
	if _, _, err := parseDarwinShortcut("CommandOrControl+Shift+MadeUp"); err == nil {
		t.Fatalf("expected unsupported key error")
	}
}

func TestRegisterNativeShortcutsDarwin(t *testing.T) {
	err := registerNativeShortcuts(models.ShortcutSettings{
		ProcessClipboardFlash: "CommandOrControl+Shift+F13",
		AdjustFlashPosition:   "CommandOrControl+Shift+F14",
		EmergencyQuit:         "CommandOrControl+Shift+F15",
	}, &MemoryEventBus{}, ShortcutHandlers{})
	if err != nil {
		t.Fatalf("register native shortcuts: %v", err)
	}
	t.Cleanup(func() {
		_ = registerNativeShortcuts(models.ShortcutSettings{}, nil, ShortcutHandlers{})
	})
}

func TestFireNativeShortcutEmitsAndRunsHandler(t *testing.T) {
	events := &MemoryEventBus{}
	done := make(chan struct{}, 1)

	fireNativeShortcut("processClipboardFlash", events, ShortcutHandlers{
		ProcessClipboard: func() {
			done <- struct{}{}
		},
	})

	if len(events.Events) != 1 || events.Events[0].Name != models.EventShortcutPressed {
		t.Fatalf("shortcut event = %#v", events.Events)
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatalf("process clipboard handler was not called")
	}
}
