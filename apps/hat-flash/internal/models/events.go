package models

const (
	EventStreamChunk      = "stream:chunk"
	EventStreamDone       = "stream:done"
	EventClipboardStarted = "clipboard:started"
	EventClipboardFailed  = "clipboard:failed"
	EventFlashShow        = "flash:show"
	EventFlashHide        = "flash:hide"
	EventAuthRequired     = "auth:required"
	EventSettingsChanged  = "settings:changed"
	EventPopoverToggle    = "popover:toggle"
	EventShortcutPressed  = "shortcut:pressed"
)
