package services

type Quitter interface {
	Quit()
}

type Autostarter interface {
	Enable() error
	Disable() error
	IsEnabled() (bool, error)
}

type AppService struct {
	quitter   Quitter
	autostart Autostarter
	events    EventBus
}

func NewAppService(events EventBus) *AppService {
	return &AppService{events: events}
}

func (s *AppService) SetQuitter(quitter Quitter) {
	s.quitter = quitter
}

func (s *AppService) SetAutostarter(autostart Autostarter) {
	s.autostart = autostart
}

func (s *AppService) Quit() {
	if s.quitter != nil {
		s.quitter.Quit()
	}
}

func (s *AppService) SetAutostart(enabled bool) error {
	if s.autostart == nil {
		return nil
	}
	if enabled {
		return s.autostart.Enable()
	}
	return s.autostart.Disable()
}

func (s *AppService) IsAutostartEnabled() (bool, error) {
	if s.autostart == nil {
		return false, nil
	}
	return s.autostart.IsEnabled()
}
