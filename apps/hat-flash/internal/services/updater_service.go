package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

var appVersion = "0.1.0-dev"

const (
	hatFlashReleasePrefix = "hat-flash-v"
	hatFlashReleasesURL   = "https://api.github.com/repos/JGSimi/Hat-Cross/releases?per_page=50"
)

type UpdaterService struct {
	client         *http.Client
	releasesURL    string
	currentVersion string
	openURL        externalURLOpener
	goos           string
	goarch         string
}

type githubRelease struct {
	TagName    string               `json:"tag_name"`
	HTMLURL    string               `json:"html_url"`
	Draft      bool                 `json:"draft"`
	Prerelease bool                 `json:"prerelease"`
	Assets     []githubReleaseAsset `json:"assets"`
}

type githubReleaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

type semanticVersion struct {
	Major int
	Minor int
	Patch int
}

func NewUpdaterService() *UpdaterService {
	return NewUpdaterServiceWithConfig(
		&http.Client{Timeout: 12 * time.Second},
		hatFlashReleasesURL,
		appVersion,
		openExternalURL,
	)
}

func NewUpdaterServiceWithConfig(client *http.Client, releasesURL string, currentVersion string, openURL externalURLOpener) *UpdaterService {
	if client == nil {
		client = &http.Client{Timeout: 12 * time.Second}
	}
	if releasesURL == "" {
		releasesURL = hatFlashReleasesURL
	}
	if strings.TrimSpace(currentVersion) == "" {
		currentVersion = appVersion
	}
	return &UpdaterService{
		client:         client,
		releasesURL:    releasesURL,
		currentVersion: strings.TrimSpace(currentVersion),
		openURL:        openURL,
		goos:           runtime.GOOS,
		goarch:         runtime.GOARCH,
	}
}

func (s *UpdaterService) Check() (models.UpdateStatus, error) {
	currentVersion := s.currentVersion
	latest, latestVersion, err := s.latestHatFlashRelease(context.Background())
	if err != nil {
		return models.UpdateStatus{
			Available:      false,
			CurrentVersion: currentVersion,
			Message:        "Nao consegui verificar updates agora.",
		}, err
	}

	currentParsed, currentOK := parseSemanticVersion(currentVersion)
	available := !currentOK || compareSemanticVersion(latestVersion, currentParsed) > 0
	if !available {
		return models.UpdateStatus{
			Available:      false,
			Version:        versionFromTag(latest.TagName),
			CurrentVersion: currentVersion,
			Message:        fmt.Sprintf("Voce ja esta na versao mais recente (%s).", currentVersion),
			ReleaseURL:     latest.HTMLURL,
		}, nil
	}

	asset := s.selectReleaseAsset(latest.Assets)
	targetURL := latest.HTMLURL
	if asset.BrowserDownloadURL != "" {
		targetURL = asset.BrowserDownloadURL
	}

	status := models.UpdateStatus{
		Available:      true,
		Version:        versionFromTag(latest.TagName),
		CurrentVersion: currentVersion,
		Message:        fmt.Sprintf("Update %s disponivel. Abrindo download no navegador.", versionFromTag(latest.TagName)),
		ReleaseURL:     latest.HTMLURL,
		DownloadURL:    asset.BrowserDownloadURL,
		AssetName:      asset.Name,
	}

	if s.openURL != nil {
		if err := s.openURL(targetURL); err != nil {
			status.Message = fmt.Sprintf("Update %s disponivel. Nao consegui abrir automaticamente: %s", status.Version, targetURL)
		}
	}

	return status, nil
}

func (s *UpdaterService) latestHatFlashRelease(ctx context.Context) (githubRelease, semanticVersion, error) {
	ctx, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.releasesURL, nil)
	if err != nil {
		return githubRelease{}, semanticVersion{}, fmt.Errorf("build update request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "HatFlash/"+s.currentVersion)

	resp, err := s.client.Do(req)
	if err != nil {
		return githubRelease{}, semanticVersion{}, fmt.Errorf("fetch releases: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return githubRelease{}, semanticVersion{}, fmt.Errorf("fetch releases: github returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var releases []githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return githubRelease{}, semanticVersion{}, fmt.Errorf("decode releases: %w", err)
	}

	var best githubRelease
	var bestVersion semanticVersion
	found := false
	for _, release := range releases {
		if release.Draft || release.Prerelease || !strings.HasPrefix(release.TagName, hatFlashReleasePrefix) {
			continue
		}
		parsed, ok := parseSemanticVersion(versionFromTag(release.TagName))
		if !ok {
			continue
		}
		if !found || compareSemanticVersion(parsed, bestVersion) > 0 {
			best = release
			bestVersion = parsed
			found = true
		}
	}

	if !found {
		return githubRelease{}, semanticVersion{}, fmt.Errorf("no Hat Flash release found")
	}
	return best, bestVersion, nil
}

func (s *UpdaterService) selectReleaseAsset(assets []githubReleaseAsset) githubReleaseAsset {
	preferred := s.preferredAssetName()
	for _, asset := range assets {
		if asset.Name == preferred && asset.BrowserDownloadURL != "" {
			return asset
		}
	}
	return githubReleaseAsset{}
}

func (s *UpdaterService) preferredAssetName() string {
	switch s.goos {
	case "windows":
		return "HatFlash-windows-x64.exe"
	case "darwin":
		if s.goarch == "arm64" {
			return "HatFlash-macos-arm64.zip"
		}
		return "HatFlash-macos-x64.zip"
	default:
		return ""
	}
}

func versionFromTag(tag string) string {
	return strings.TrimPrefix(strings.TrimSpace(tag), hatFlashReleasePrefix)
}

func parseSemanticVersion(version string) (semanticVersion, bool) {
	normalized := strings.TrimSpace(strings.TrimPrefix(version, "v"))
	if cut := strings.IndexAny(normalized, "-+"); cut >= 0 {
		normalized = normalized[:cut]
	}
	parts := strings.Split(normalized, ".")
	if len(parts) == 0 || len(parts) > 3 {
		return semanticVersion{}, false
	}

	values := [3]int{}
	for index, part := range parts {
		if part == "" {
			return semanticVersion{}, false
		}
		value, err := strconv.Atoi(part)
		if err != nil || value < 0 {
			return semanticVersion{}, false
		}
		values[index] = value
	}

	return semanticVersion{Major: values[0], Minor: values[1], Patch: values[2]}, true
}

func compareSemanticVersion(left semanticVersion, right semanticVersion) int {
	if left.Major != right.Major {
		return left.Major - right.Major
	}
	if left.Minor != right.Minor {
		return left.Minor - right.Minor
	}
	return left.Patch - right.Patch
}
