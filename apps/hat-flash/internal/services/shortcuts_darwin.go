//go:build darwin

package services

/*
#cgo darwin LDFLAGS: -framework Carbon
#include <Carbon/Carbon.h>

extern void goHatFlashHotKeyPressed(int id);

static EventHandlerRef hatFlashHotKeyHandlerRef = NULL;
static EventHandlerUPP hatFlashHotKeyHandlerUPP = NULL;

static OSStatus hatFlashHotKeyHandler(EventHandlerCallRef nextHandler, EventRef event, void *userData) {
	EventHotKeyID hotKeyID;
	OSStatus status = GetEventParameter(
		event,
		kEventParamDirectObject,
		typeEventHotKeyID,
		NULL,
		sizeof(hotKeyID),
		NULL,
		&hotKeyID
	);
	if (status == noErr) {
		goHatFlashHotKeyPressed((int)hotKeyID.id);
	}
	return noErr;
}

static OSStatus installHatFlashHotKeyHandler(void) {
	if (hatFlashHotKeyHandlerRef != NULL) {
		return noErr;
	}
	EventTypeSpec eventType;
	eventType.eventClass = kEventClassKeyboard;
	eventType.eventKind = kEventHotKeyPressed;
	hatFlashHotKeyHandlerUPP = NewEventHandlerUPP(hatFlashHotKeyHandler);
	return InstallApplicationEventHandler(
		hatFlashHotKeyHandlerUPP,
		1,
		&eventType,
		NULL,
		&hatFlashHotKeyHandlerRef
	);
}

static OSStatus registerHatFlashHotKey(UInt32 keyCode, UInt32 modifiers, UInt32 id, EventHotKeyRef *ref) {
	EventHotKeyID hotKeyID;
	hotKeyID.signature = 'HTFL';
	hotKeyID.id = id;
	return RegisterEventHotKey(keyCode, modifiers, hotKeyID, GetApplicationEventTarget(), 0, ref);
}

static OSStatus unregisterHatFlashHotKey(EventHotKeyRef ref) {
	return UnregisterEventHotKey(ref);
}
*/
import "C"

import (
	"errors"
	"fmt"
	"runtime"
	"strconv"
	"strings"
	"sync"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const darwinHotkeyBaseID = 6200

var (
	darwinShortcutsMu         sync.Mutex
	darwinShortcutsOnce       sync.Once
	darwinShortcutsHandlerErr error
	darwinShortcutsRefs       []C.EventHotKeyRef
	darwinShortcutsActions    = map[int]string{}
	darwinShortcutsEvents     EventBus
	darwinShortcutsHandlers   ShortcutHandlers
)

func registerNativeShortcuts(settings models.ShortcutSettings, events EventBus, handlers ShortcutHandlers) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	darwinShortcutsMu.Lock()
	defer darwinShortcutsMu.Unlock()

	darwinShortcutsOnce.Do(func() {
		if status := C.installHatFlashHotKeyHandler(); status != C.noErr {
			darwinShortcutsHandlerErr = fmt.Errorf("install macOS hotkey handler: status %d", int(status))
		}
	})
	if darwinShortcutsHandlerErr != nil {
		return darwinShortcutsHandlerErr
	}

	for _, ref := range darwinShortcutsRefs {
		_ = C.unregisterHatFlashHotKey(ref)
	}
	darwinShortcutsRefs = nil
	darwinShortcutsActions = map[int]string{}
	darwinShortcutsEvents = events
	darwinShortcutsHandlers = handlers

	registrations := []struct {
		id       int
		action   string
		shortcut string
	}{
		{darwinHotkeyBaseID + 1, "processClipboardFlash", settings.ProcessClipboardFlash},
		{darwinHotkeyBaseID + 2, "adjustFlashPosition", settings.AdjustFlashPosition},
		{darwinHotkeyBaseID + 3, "emergencyQuit", settings.EmergencyQuit},
	}

	var registrationErrors []error
	for _, registration := range registrations {
		if strings.TrimSpace(registration.shortcut) == "" {
			continue
		}
		modifiers, keyCode, err := parseDarwinShortcut(registration.shortcut)
		if err != nil {
			registrationErrors = append(registrationErrors, fmt.Errorf("%s: %w", registration.action, err))
			continue
		}
		var ref C.EventHotKeyRef
		if status := C.registerHatFlashHotKey(C.UInt32(keyCode), C.UInt32(modifiers), C.UInt32(registration.id), &ref); status != C.noErr {
			registrationErrors = append(registrationErrors, fmt.Errorf("%s: register macOS hotkey %s: %s", registration.action, registration.shortcut, darwinHotKeyStatus(status)))
			continue
		}
		darwinShortcutsRefs = append(darwinShortcutsRefs, ref)
		darwinShortcutsActions[registration.id] = registration.action
	}
	return errors.Join(registrationErrors...)
}

//export goHatFlashHotKeyPressed
func goHatFlashHotKeyPressed(id C.int) {
	darwinShortcutsMu.Lock()
	action := darwinShortcutsActions[int(id)]
	events := darwinShortcutsEvents
	handlers := darwinShortcutsHandlers
	darwinShortcutsMu.Unlock()
	application.InvokeAsync(func() {
		fireNativeShortcut(action, events, handlers)
	})
}

func fireNativeShortcut(action string, events EventBus, handlers ShortcutHandlers) {
	if action == "" {
		return
	}
	if events != nil {
		events.Emit(models.EventShortcutPressed, map[string]any{"action": action})
	}
	switch action {
	case "processClipboardFlash":
		if handlers.ProcessClipboard != nil {
			go handlers.ProcessClipboard()
		}
	case "adjustFlashPosition":
		if events != nil {
			events.Emit("flash-adjust-enter", nil)
		}
		if handlers.AdjustFlash != nil {
			go handlers.AdjustFlash()
		}
	case "emergencyQuit":
		if handlers.EmergencyQuit != nil {
			go handlers.EmergencyQuit()
		}
	}
}

func parseDarwinShortcut(shortcut string) (uint, uint, error) {
	parts := strings.Split(shortcut, "+")
	if len(parts) < 2 {
		return 0, 0, fmt.Errorf("shortcut %q needs modifiers", shortcut)
	}

	var modifiers uint
	for _, raw := range parts[:len(parts)-1] {
		switch strings.ToLower(strings.TrimSpace(raw)) {
		case "commandorcontrol", "command", "cmd", "meta":
			modifiers |= uint(C.cmdKey)
		case "control", "ctrl":
			modifiers |= uint(C.controlKey)
		case "shift":
			modifiers |= uint(C.shiftKey)
		case "alt", "option":
			modifiers |= uint(C.optionKey)
		default:
			return 0, 0, fmt.Errorf("unsupported shortcut modifier %q", raw)
		}
	}

	key := strings.ToUpper(strings.TrimSpace(parts[len(parts)-1]))
	if keyCode, ok := darwinKeyCodes[key]; ok {
		return modifiers, keyCode, nil
	}
	if strings.HasPrefix(key, "F") {
		n, err := strconv.Atoi(strings.TrimPrefix(key, "F"))
		if err == nil {
			if keyCode, ok := darwinFunctionKeyCodes[n]; ok {
				return modifiers, keyCode, nil
			}
		}
	}
	return 0, 0, fmt.Errorf("unsupported shortcut key %q", key)
}

func darwinHotKeyStatus(status C.OSStatus) string {
	switch status {
	case C.eventHotKeyExistsErr:
		return "shortcut already in use"
	case C.eventHotKeyInvalidErr:
		return "invalid shortcut"
	default:
		return fmt.Sprintf("status %d", int(status))
	}
}

var darwinKeyCodes = map[string]uint{
	"A": 0x00, "S": 0x01, "D": 0x02, "F": 0x03, "H": 0x04, "G": 0x05,
	"Z": 0x06, "X": 0x07, "C": 0x08, "V": 0x09, "B": 0x0B, "Q": 0x0C,
	"W": 0x0D, "E": 0x0E, "R": 0x0F, "Y": 0x10, "T": 0x11, "1": 0x12,
	"2": 0x13, "3": 0x14, "4": 0x15, "6": 0x16, "5": 0x17, "=": 0x18,
	"9": 0x19, "7": 0x1A, "-": 0x1B, "8": 0x1C, "0": 0x1D, "]": 0x1E,
	"O": 0x1F, "U": 0x20, "[": 0x21, "I": 0x22, "P": 0x23, "L": 0x25,
	"J": 0x26, "'": 0x27, "K": 0x28, ";": 0x29, "\\": 0x2A, ",": 0x2B,
	"/": 0x2C, "N": 0x2D, "M": 0x2E, ".": 0x2F, "`": 0x32,
	"RETURN": 0x24, "ENTER": 0x24, "TAB": 0x30, "SPACE": 0x31, "DELETE": 0x33,
	"BACKSPACE": 0x33, "ESC": 0x35, "ESCAPE": 0x35,
}

var darwinFunctionKeyCodes = map[int]uint{
	1: 0x7A, 2: 0x78, 3: 0x63, 4: 0x76, 5: 0x60, 6: 0x61,
	7: 0x62, 8: 0x64, 9: 0x65, 10: 0x6D, 11: 0x67, 12: 0x6F,
	13: 0x69, 14: 0x6B, 15: 0x71, 16: 0x6A, 17: 0x40, 18: 0x4F,
	19: 0x50, 20: 0x5A,
}
