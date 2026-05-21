//go:build !windows && !darwin

package services

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"

func registerNativeShortcuts(settings models.ShortcutSettings, events EventBus, handlers ShortcutHandlers) error {
	return nil
}
