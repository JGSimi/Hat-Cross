package models

type UpdateStatus struct {
	Available bool   `json:"available"`
	Version   string `json:"version,omitempty"`
	Message   string `json:"message"`
}
