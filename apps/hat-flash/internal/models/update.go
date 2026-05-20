package models

type UpdateStatus struct {
	Available      bool   `json:"available"`
	Version        string `json:"version,omitempty"`
	CurrentVersion string `json:"currentVersion,omitempty"`
	Message        string `json:"message"`
	ReleaseURL     string `json:"releaseUrl,omitempty"`
	DownloadURL    string `json:"downloadUrl,omitempty"`
	AssetName      string `json:"assetName,omitempty"`
}
