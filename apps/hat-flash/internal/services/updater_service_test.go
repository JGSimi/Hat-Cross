package services

import (
	"fmt"
	"net/http"
	"net/http/httptest"
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
