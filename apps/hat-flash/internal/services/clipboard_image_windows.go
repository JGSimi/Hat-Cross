//go:build windows

package services

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"unsafe"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"golang.org/x/sys/windows"
)

const (
	cfDIB                = 8
	biRGB                = 0
	biBitFields          = 3
	maxClipboardDIBBytes = 25 * 1024 * 1024
	maxClipboardPixels   = 20_000_000
)

var (
	user32                   = windows.NewLazySystemDLL("user32.dll")
	kernel32                 = windows.NewLazySystemDLL("kernel32.dll")
	procOpenClipboard        = user32.NewProc("OpenClipboard")
	procCloseClipboard       = user32.NewProc("CloseClipboard")
	procIsClipboardAvailable = user32.NewProc("IsClipboardFormatAvailable")
	procGetClipboardData     = user32.NewProc("GetClipboardData")
	procGlobalLock           = kernel32.NewProc("GlobalLock")
	procGlobalUnlock         = kernel32.NewProc("GlobalUnlock")
	procGlobalSize           = kernel32.NewProc("GlobalSize")
)

func readClipboardImageNative() (*models.ClipboardImage, error) {
	ok, _, err := procOpenClipboard.Call(0)
	if ok == 0 {
		return nil, fmt.Errorf("open clipboard: %w", err)
	}
	defer procCloseClipboard.Call()

	available, _, _ := procIsClipboardAvailable.Call(cfDIB)
	if available == 0 {
		return nil, ErrClipboardImageUnsupported
	}

	handle, _, err := procGetClipboardData.Call(cfDIB)
	if handle == 0 {
		return nil, fmt.Errorf("get clipboard image: %w", err)
	}

	ptr, _, err := procGlobalLock.Call(handle)
	if ptr == 0 {
		return nil, fmt.Errorf("lock clipboard image: %w", err)
	}
	defer procGlobalUnlock.Call(handle)

	size, _, _ := procGlobalSize.Call(handle)
	if size == 0 {
		return nil, errorsNew("clipboard image has zero bytes")
	}
	if size > maxClipboardDIBBytes {
		return nil, fmt.Errorf("clipboard image too large: %d bytes", size)
	}
	data := unsafe.Slice((*byte)(unsafe.Pointer(ptr)), int(size))
	return dibToPNGDataURL(data)
}

func dibToPNGDataURL(data []byte) (*models.ClipboardImage, error) {
	if len(data) < 40 {
		return nil, errorsNew("clipboard DIB header too small")
	}
	headerSize := int(binary.LittleEndian.Uint32(data[0:4]))
	if headerSize < 40 || len(data) < headerSize {
		return nil, fmt.Errorf("unsupported DIB header size %d", headerSize)
	}
	width := int(int32(binary.LittleEndian.Uint32(data[4:8])))
	rawHeight := int(int32(binary.LittleEndian.Uint32(data[8:12])))
	bitCount := int(binary.LittleEndian.Uint16(data[14:16]))
	compression := binary.LittleEndian.Uint32(data[16:20])
	if width <= 0 || rawHeight == 0 {
		return nil, errorsNew("invalid DIB dimensions")
	}
	topDown := rawHeight < 0
	height := rawHeight
	if height < 0 {
		height = -height
	}
	if int64(width)*int64(height) > maxClipboardPixels {
		return nil, fmt.Errorf("clipboard image too large: %dx%d", width, height)
	}
	if compression != biRGB && compression != biBitFields {
		return nil, fmt.Errorf("unsupported DIB compression %d", compression)
	}
	if bitCount != 24 && bitCount != 32 {
		return nil, fmt.Errorf("unsupported DIB bit depth %d", bitCount)
	}

	offset := headerSize
	if compression == biBitFields && headerSize == 40 {
		offset += 12
	}
	stride64 := ((int64(width)*int64(bitCount) + 31) / 32) * 4
	required64 := int64(offset) + stride64*int64(height)
	if stride64 <= 0 || required64 > int64(len(data)) || required64 > maxClipboardDIBBytes {
		return nil, errorsNew("clipboard DIB pixel data truncated")
	}
	stride := int(stride64)

	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		sourceY := y
		if !topDown {
			sourceY = height - 1 - y
		}
		row := data[offset+sourceY*stride:]
		for x := 0; x < width; x++ {
			p := x * (bitCount / 8)
			b := row[p]
			g := row[p+1]
			r := row[p+2]
			a := uint8(255)
			if bitCount == 32 {
				a = row[p+3]
				if a == 0 {
					a = 255
				}
			}
			img.SetNRGBA(x, y, color.NRGBA{R: r, G: g, B: b, A: a})
		}
	}

	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		return nil, err
	}
	return &models.ClipboardImage{
		MimeType: "image/png",
		DataURL:  "data:image/png;base64," + base64.StdEncoding.EncodeToString(out.Bytes()),
		Width:    width,
		Height:   height,
	}, nil
}

func errorsNew(message string) error {
	return fmt.Errorf("%s", message)
}
