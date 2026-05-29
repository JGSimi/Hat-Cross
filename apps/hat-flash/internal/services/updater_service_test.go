package services

import (
	"archive/zip"
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestUpdaterCheckOpensPreferredAssetWhenUpdateExists(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("User-Agent"); got != "HatFlash/0.1.2" {
			t.Fatalf("User-Agent = %q", got)
		}
		fmt.Fprint(w, `[
			{"tag_name":"v2.61.0","html_url":"https://example.test/main","draft":false,"prerelease":false,"assets":[]},
			{"tag_name":"hat-flash-v0.1.1","html_url":"https://example.test/old","draft":false,"prerelease":false,"assets":[]},
			{"tag_name":"hat-flash-v0.1.3","html_url":"https://example.test/release","draft":false,"prerelease":false,"assets":[
				{"name":"HatFlash-macos-arm64.zip","browser_download_url":"https://example.test/arm64.zip"},
				{"name":"HatFlash-macos-x64.zip","browser_download_url":"https://example.test/x64.zip"},
				{"name":"HatFlash-windows-x64.exe","browser_download_url":"https://example.test/windows.exe"}
			]}
		]`)
	}))
	defer server.Close()

	var opened string
	service := NewUpdaterServiceWithConfig(server.Client(), server.URL, "0.1.2", func(rawURL string) error {
		opened = rawURL
		return nil
	})
	service.goos = "darwin"
	service.goarch = "arm64"

	status, err := service.Check()
	if err != nil {
		t.Fatalf("Check() error = %v", err)
	}
	if !status.Available {
		t.Fatalf("Available = false, want true")
	}
	if status.Version != "0.1.3" {
		t.Fatalf("Version = %q, want 0.1.3", status.Version)
	}
	if status.CurrentVersion != "0.1.2" {
		t.Fatalf("CurrentVersion = %q, want 0.1.2", status.CurrentVersion)
	}
	if status.AssetName != "HatFlash-macos-arm64.zip" {
		t.Fatalf("AssetName = %q", status.AssetName)
	}
	if opened != "https://example.test/arm64.zip" {
		t.Fatalf("opened = %q", opened)
	}
}

func TestUpdaterCheckDoesNotOpenWhenAlreadyCurrent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `[
			{"tag_name":"hat-flash-v0.1.3","html_url":"https://example.test/release","draft":false,"prerelease":false,"assets":[]}
		]`)
	}))
	defer server.Close()

	service := NewUpdaterServiceWithConfig(server.Client(), server.URL, "0.1.3", func(rawURL string) error {
		t.Fatalf("openURL called with %q", rawURL)
		return nil
	})

	status, err := service.Check()
	if err != nil {
		t.Fatalf("Check() error = %v", err)
	}
	if status.Available {
		t.Fatalf("Available = true, want false")
	}
	if status.Version != "0.1.3" {
		t.Fatalf("Version = %q, want 0.1.3", status.Version)
	}
}

func TestUpdaterCheckFallsBackToReleasePageWithoutPlatformAsset(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, `[
			{"tag_name":"hat-flash-v0.1.10","html_url":"https://example.test/release","draft":false,"prerelease":false,"assets":[
				{"name":"HatFlash-macos-arm64.zip","browser_download_url":"https://example.test/arm64.zip"}
			]},
			{"tag_name":"hat-flash-v0.1.2","html_url":"https://example.test/old","draft":false,"prerelease":false,"assets":[]}
		]`)
	}))
	defer server.Close()

	var opened string
	service := NewUpdaterServiceWithConfig(server.Client(), server.URL, "0.1.2", func(rawURL string) error {
		opened = rawURL
		return nil
	})
	service.goos = "linux"
	service.goarch = "amd64"

	status, err := service.Check()
	if err != nil {
		t.Fatalf("Check() error = %v", err)
	}
	if !status.Available {
		t.Fatalf("Available = false, want true")
	}
	if status.Version != "0.1.10" {
		t.Fatalf("Version = %q, want 0.1.10", status.Version)
	}
	if opened != "https://example.test/release" {
		t.Fatalf("opened = %q", opened)
	}
}

func TestParseSemanticVersion(t *testing.T) {
	cases := map[string]semanticVersion{
		"0.1.2":      {Major: 0, Minor: 1, Patch: 2},
		"0.1.2-dev":  {Major: 0, Minor: 1, Patch: 2},
		"v1.2.3+abc": {Major: 1, Minor: 2, Patch: 3},
	}
	for input, want := range cases {
		got, ok := parseSemanticVersion(input)
		if !ok {
			t.Fatalf("parseSemanticVersion(%q) ok = false", input)
		}
		if got != want {
			t.Fatalf("parseSemanticVersion(%q) = %#v, want %#v", input, got, want)
		}
	}
}

func TestAppBundlePath(t *testing.T) {
	cases := []struct {
		input    string
		wantPath string
		wantOk   bool
	}{
		{
			input:    "/Applications/HatFlash.app/Contents/MacOS/HatFlash",
			wantPath: "/Applications/HatFlash.app",
			wantOk:   true,
		},
		{
			input:    "HatFlash.app/Contents/MacOS/HatFlash",
			wantPath: "HatFlash.app",
			wantOk:   true,
		},
		{
			input:    "/usr/local/bin/HatFlash",
			wantPath: "",
			wantOk:   false,
		},
		{
			input:    "C:\\Program Files\\HatFlash\\HatFlash.exe",
			wantPath: "",
			wantOk:   false,
		},
	}

	for _, tc := range cases {
		gotPath, gotOk := appBundlePath(tc.input)
		if gotOk != tc.wantOk {
			t.Errorf("appBundlePath(%q) ok = %v, want %v", tc.input, gotOk, tc.wantOk)
		}
		if gotPath != tc.wantPath {
			t.Errorf("appBundlePath(%q) path = %q, want %q", tc.input, gotPath, tc.wantPath)
		}
	}
}

func TestReplaceFile(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "hat-flash-replace-test-*")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	targetPath := filepath.Join(tmpDir, "target.bin")
	newFilePath := filepath.Join(tmpDir, "new.bin")

	if err := os.WriteFile(targetPath, []byte("original"), 0755); err != nil {
		t.Fatalf("Write target: %v", err)
	}

	if err := os.WriteFile(newFilePath, []byte("updated"), 0755); err != nil {
		t.Fatalf("Write new file: %v", err)
	}

	if err := replaceFile(targetPath, newFilePath); err != nil {
		t.Fatalf("replaceFile: %v", err)
	}

	got, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("Read target after replace: %v", err)
	}
	if string(got) != "updated" {
		t.Fatalf("target content = %q, want %q", got, "updated")
	}

	if err := replaceFile(targetPath, filepath.Join(tmpDir, "nonexistent.bin")); err == nil {
		t.Fatalf("expected replaceFile error for nonexistent source")
	}

	got, err = os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("Read target after failed replace: %v", err)
	}
	if string(got) != "updated" {
		t.Fatalf("target content changed after failed replace: %q, want %q", got, "updated")
	}
}

func TestUnzip(t *testing.T) {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	f1, err := w.Create("nested/file1.txt")
	if err != nil {
		t.Fatalf("zip create file1: %v", err)
	}
	if _, err := f1.Write([]byte("hello file1")); err != nil {
		t.Fatalf("zip write file1: %v", err)
	}

	f2, err := w.Create("file2.txt")
	if err != nil {
		t.Fatalf("zip create file2: %v", err)
	}
	if _, err := f2.Write([]byte("hello file2")); err != nil {
		t.Fatalf("zip write file2: %v", err)
	}

	if err := w.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}

	tmpFile, err := os.CreateTemp("", "hat-flash-unzip-src-*.zip")
	if err != nil {
		t.Fatalf("CreateTemp: %v", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	if _, err := tmpFile.Write(buf.Bytes()); err != nil {
		t.Fatalf("Write zip file: %v", err)
	}

	destDir, err := os.MkdirTemp("", "hat-flash-unzip-dest-*")
	if err != nil {
		t.Fatalf("MkdirTemp dest: %v", err)
	}
	defer os.RemoveAll(destDir)

	if err := unzip(tmpFile.Name(), destDir); err != nil {
		t.Fatalf("unzip: %v", err)
	}

	got1, err := os.ReadFile(filepath.Join(destDir, "nested", "file1.txt"))
	if err != nil {
		t.Fatalf("Read file1: %v", err)
	}
	if string(got1) != "hello file1" {
		t.Fatalf("file1 content = %q, want %q", got1, "hello file1")
	}

	got2, err := os.ReadFile(filepath.Join(destDir, "file2.txt"))
	if err != nil {
		t.Fatalf("Read file2: %v", err)
	}
	if string(got2) != "hello file2" {
		t.Fatalf("file2 content = %q, want %q", got2, "hello file2")
	}
}

func TestDownloadAndInstallWindowsBinary(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "hat-flash-update-win-*")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	exePath := filepath.Join(tmpDir, "HatFlash.exe")
	if err := os.WriteFile(exePath, []byte("old binary content"), 0755); err != nil {
		t.Fatalf("Write dummy executable: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("new binary content"))
	}))
	defer server.Close()

	service := NewUpdaterServiceWithConfig(server.Client(), "", "0.1.0", nil)
	service.goos = "windows"
	service.getExePath = func() (string, error) {
		return exePath, nil
	}

	err = service.downloadAndInstall(server.URL, "HatFlash-windows-x64.exe")
	if err != nil {
		t.Fatalf("downloadAndInstall Windows: %v", err)
	}

	got, err := os.ReadFile(exePath)
	if err != nil {
		t.Fatalf("Read replaced exe: %v", err)
	}
	if string(got) != "new binary content" {
		t.Fatalf("exe content = %q, want %q", got, "new binary content")
	}

	if _, err := os.Stat(exePath + ".old"); !os.IsNotExist(err) {
		t.Errorf("expected .old file to be cleaned up, stat err: %v", err)
	}
}

func TestDownloadAndInstallDarwinAppBundle(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "hat-flash-update-darwin-*")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	bundlePath := filepath.Join(tmpDir, "HatFlash.app")
	exeInBundle := filepath.Join(bundlePath, "Contents", "MacOS", "HatFlash")
	if err := os.MkdirAll(filepath.Dir(exeInBundle), 0755); err != nil {
		t.Fatalf("MkdirAll app bundle structures: %v", err)
	}
	if err := os.WriteFile(exeInBundle, []byte("old bundle binary"), 0755); err != nil {
		t.Fatalf("Write dummy exe in bundle: %v", err)
	}

	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	newExePathInZip := "HatFlash.app/Contents/MacOS/HatFlash"
	newExeFile, err := w.Create(newExePathInZip)
	if err != nil {
		t.Fatalf("zip create: %v", err)
	}
	if _, err := newExeFile.Write([]byte("new bundle binary")); err != nil {
		t.Fatalf("zip write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("zip close: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		w.Write(buf.Bytes())
	}))
	defer server.Close()

	service := NewUpdaterServiceWithConfig(server.Client(), "", "0.1.0", nil)
	service.goos = "darwin"
	service.goarch = "arm64"
	service.getExePath = func() (string, error) {
		return exeInBundle, nil
	}

	err = service.downloadAndInstall(server.URL, "HatFlash-macos-arm64.zip")
	if err != nil {
		t.Fatalf("downloadAndInstall Darwin: %v", err)
	}

	got, err := os.ReadFile(exeInBundle)
	if err != nil {
		t.Fatalf("Read replaced app bundle exe: %v", err)
	}
	if string(got) != "new bundle binary" {
		t.Fatalf("replaced bundle exe content = %q, want %q", got, "new bundle binary")
	}

	if _, err := os.Stat(bundlePath + ".old"); !os.IsNotExist(err) {
		t.Errorf("expected .old bundle folder to be cleaned up")
	}
}
