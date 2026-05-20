//go:build !windows

package services

import "github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"

func readClipboardImageNative() (*models.ClipboardImage, error) {
	return nil, ErrClipboardImageUnsupported
}
