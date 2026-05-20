//go:build windows

package services

import (
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"golang.org/x/sys/windows"
)

const (
	modAlt       = 0x0001
	modControl   = 0x0002
	modShift     = 0x0004
	modWin       = 0x0008
	modNoRepeat  = 0x4000
	wmHotkey     = 0x0312
	pmRemove     = 0x0001
	hotkeyBaseID = 6100
)

var (
	shortcutLoopOnce sync.Once
	shortcutLoop     *windowsShortcutLoop

	shortcutUser32       = windows.NewLazySystemDLL("user32.dll")
	procRegisterHotKey   = shortcutUser32.NewProc("RegisterHotKey")
	procUnregisterHotKey = shortcutUser32.NewProc("UnregisterHotKey")
	procPeekMessageW     = shortcutUser32.NewProc("PeekMessageW")
)

type windowsShortcutLoop struct {
	commands chan shortcutCommand
	events   EventBus
	handlers ShortcutHandlers
	actions  map[int]string
}

type shortcutCommand struct {
	settings models.ShortcutSettings
	events   EventBus
	handlers ShortcutHandlers
	done     chan error
}

type windowsPoint struct {
	X int32
	Y int32
}

type windowsMessage struct {
	Hwnd     uintptr
	Message  uint32
	WParam   uintptr
	LParam   uintptr
	Time     uint32
	Pt       windowsPoint
	LPrivate uint32
}

func registerNativeShortcuts(settings models.ShortcutSettings, events EventBus, handlers ShortcutHandlers) error {
	shortcutLoopOnce.Do(func() {
		shortcutLoop = &windowsShortcutLoop{
			commands: make(chan shortcutCommand),
			actions:  map[int]string{},
		}
		go shortcutLoop.run()
	})

	done := make(chan error, 1)
	shortcutLoop.commands <- shortcutCommand{
		settings: settings,
		events:   events,
		handlers: handlers,
		done:     done,
	}
	return <-done
}

func (l *windowsShortcutLoop) run() {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	for {
		select {
		case command := <-l.commands:
			command.done <- l.apply(command)
		default:
			l.drainMessages()
			time.Sleep(20 * time.Millisecond)
		}
	}
}

func (l *windowsShortcutLoop) apply(command shortcutCommand) error {
	for id := range l.actions {
		procUnregisterHotKey.Call(0, uintptr(id))
	}
	l.actions = map[int]string{}
	l.events = command.events
	l.handlers = command.handlers

	registrations := []struct {
		id       int
		action   string
		shortcut string
	}{
		{hotkeyBaseID + 1, "clipboard", command.settings.Clipboard},
		{hotkeyBaseID + 2, "floatingChat", command.settings.FloatingChat},
		{hotkeyBaseID + 3, "adjustFlashPosition", command.settings.AdjustFlashPosition},
		{hotkeyBaseID + 4, "emergencyQuit", command.settings.EmergencyQuit},
	}

	for _, registration := range registrations {
		if strings.TrimSpace(registration.shortcut) == "" {
			continue
		}
		modifiers, vk, err := parseWindowsShortcut(registration.shortcut)
		if err != nil {
			return err
		}
		ok, _, callErr := procRegisterHotKey.Call(0, uintptr(registration.id), uintptr(modifiers|modNoRepeat), uintptr(vk))
		if ok == 0 {
			return fmt.Errorf("register hotkey %s: %w", registration.shortcut, callErr)
		}
		l.actions[registration.id] = registration.action
	}
	return nil
}

func (l *windowsShortcutLoop) drainMessages() {
	for {
		var message windowsMessage
		ok, _, _ := procPeekMessageW.Call(uintptr(unsafe.Pointer(&message)), 0, 0, 0, pmRemove)
		if ok == 0 {
			return
		}
		if message.Message != wmHotkey {
			continue
		}
		action := l.actions[int(message.WParam)]
		if action == "" {
			continue
		}
		l.fire(action)
	}
}

func (l *windowsShortcutLoop) fire(action string) {
	if l.events != nil {
		l.events.Emit(models.EventShortcutPressed, map[string]any{"action": action})
	}
	switch action {
	case "clipboard":
		if l.events != nil {
			l.events.Emit("process-clipboard", nil)
		}
		if l.handlers.ProcessClipboard != nil {
			go l.handlers.ProcessClipboard()
		}
	case "floatingChat":
		if l.handlers.TogglePopover != nil {
			go l.handlers.TogglePopover()
		}
	case "adjustFlashPosition":
		if l.events != nil {
			l.events.Emit("flash-adjust-enter", nil)
		}
		if l.handlers.AdjustFlash != nil {
			go l.handlers.AdjustFlash()
		}
	case "emergencyQuit":
		if l.handlers.EmergencyQuit != nil {
			go l.handlers.EmergencyQuit()
		}
	}
}

func parseWindowsShortcut(shortcut string) (uint, uint, error) {
	parts := strings.Split(shortcut, "+")
	if len(parts) < 2 {
		return 0, 0, fmt.Errorf("shortcut %q needs modifiers", shortcut)
	}

	var modifiers uint
	for _, raw := range parts[:len(parts)-1] {
		switch strings.ToLower(strings.TrimSpace(raw)) {
		case "commandorcontrol", "control", "ctrl":
			modifiers |= modControl
		case "shift":
			modifiers |= modShift
		case "alt", "option":
			modifiers |= modAlt
		case "command", "cmd", "meta", "win", "windows":
			modifiers |= modWin
		default:
			return 0, 0, fmt.Errorf("unsupported shortcut modifier %q", raw)
		}
	}

	key := strings.ToUpper(strings.TrimSpace(parts[len(parts)-1]))
	if len(key) == 1 {
		r := key[0]
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			return modifiers, uint(r), nil
		}
	}
	if strings.HasPrefix(key, "F") {
		n, err := strconv.Atoi(strings.TrimPrefix(key, "F"))
		if err == nil && n >= 1 && n <= 24 {
			return modifiers, uint(0x70 + n - 1), nil
		}
	}
	switch key {
	case "ESC", "ESCAPE":
		return modifiers, 0x1B, nil
	case "SPACE":
		return modifiers, 0x20, nil
	}
	return 0, 0, fmt.Errorf("unsupported shortcut key %q", key)
}
