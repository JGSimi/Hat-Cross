package main

import (
	"embed"
	"log"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/controllers"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/repositories"
	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/services"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	application.RegisterEvent[models.StreamChunk](models.EventStreamChunk)
	application.RegisterEvent[map[string]any](models.EventStreamDone)
	application.RegisterEvent[any](models.EventClipboardStarted)
	application.RegisterEvent[string](models.EventClipboardFailed)
	application.RegisterEvent[models.FlashPayload](models.EventFlashShow)
	application.RegisterEvent[any](models.EventFlashHide)
	application.RegisterEvent[map[string]any](models.EventAuthRequired)
	application.RegisterEvent[models.Settings](models.EventSettingsChanged)
	application.RegisterEvent[any](models.EventPopoverToggle)
	application.RegisterEvent[map[string]any](models.EventShortcutPressed)
}

func main() {
	eventHub := services.NewEventHub()

	settingsPath, err := repositories.DefaultSettingsPath()
	if err != nil {
		settingsPath = "settings.json"
	}
	historyPath, err := repositories.DefaultHistoryPath()
	if err != nil {
		historyPath = "history.json"
	}

	settingsRepo := repositories.NewSettingsRepository(settingsPath)
	_ = repositories.NewHistoryRepository(historyPath)

	sessionService := services.NewSessionService(eventHub)
	authService := services.NewAuthService()
	settingsService := services.NewSettingsService(settingsRepo, eventHub)
	clipboardService := services.NewClipboardService(nil, eventHub)
	chatService := services.NewChatService(nil, sessionService, eventHub, "")
	windowService := services.NewWindowService(eventHub)
	shortcutService := services.NewShortcutService(eventHub)
	updaterService := services.NewUpdaterService()
	appService := services.NewAppService(eventHub)

	sessionController := controllers.NewSessionController(sessionService)
	authController := controllers.NewAuthController(authService)
	clipboardController := controllers.NewClipboardController(clipboardService)
	chatController := controllers.NewChatController(chatService)
	flashController := controllers.NewFlashController(windowService)
	popoverController := controllers.NewPopoverController(windowService)
	shortcutsController := controllers.NewShortcutsController(shortcutService)
	settingsController := controllers.NewSettingsController(settingsService)
	updaterController := controllers.NewUpdaterController(updaterService)
	appController := controllers.NewAppController(appService)

	app := application.New(application.Options{
		Name:        "HatFlash",
		Description: "Hat Flash",
		Services: []application.Service{
			application.NewService(sessionController),
			application.NewService(authController),
			application.NewService(clipboardController),
			application.NewService(chatController),
			application.NewService(flashController),
			application.NewService(popoverController),
			application.NewService(shortcutsController),
			application.NewService(settingsController),
			application.NewService(updaterController),
			application.NewService(appController),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	eventHub.SetTarget(app.Event)
	clipboardService.SetTextClipboard(app.Clipboard)
	appService.SetQuitter(app)
	appService.SetAutostarter(app.Autostart)
	shortcutService.SetHandlers(services.ShortcutHandlers{
		ProcessClipboard: func() {
			_, _ = clipboardService.Process()
		},
		TogglePopover: windowService.TogglePopover,
		EmergencyQuit: appService.Quit,
	})

	mainWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:             "main",
		Title:            "Hat Flash",
		Width:            920,
		Height:           680,
		MinWidth:         720,
		MinHeight:        540,
		Frameless:        true,
		URL:              "/",
		BackgroundColour: application.NewRGB(10, 12, 16),
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		Windows: application.WindowsWindow{
			Theme: application.Dark,
			Permissions: map[application.CoreWebView2PermissionKind]application.CoreWebView2PermissionState{
				application.CoreWebView2PermissionKindClipboardRead: application.CoreWebView2PermissionStateAllow,
				application.CoreWebView2PermissionKindNotifications: application.CoreWebView2PermissionStateAllow,
			},
		},
	})
	popoverWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                     "popover",
		Title:                    "Hat Flash Popover",
		Width:                    380,
		Height:                   480,
		MinWidth:                 300,
		MinHeight:                350,
		Frameless:                true,
		AlwaysOnTop:              true,
		Hidden:                   true,
		URL:                      "/popover",
		BackgroundType:           application.BackgroundTypeTransparent,
		ContentProtectionEnabled: true,
		HideOnEscape:             true,
		Windows: application.WindowsWindow{
			Theme:           application.Dark,
			HiddenOnTaskbar: true,
			Permissions: map[application.CoreWebView2PermissionKind]application.CoreWebView2PermissionState{
				application.CoreWebView2PermissionKindClipboardRead: application.CoreWebView2PermissionStateAllow,
			},
		},
	})
	flashWindow := app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:                     "flash",
		Title:                    "Hat Flash",
		Width:                    420,
		Height:                   90,
		Frameless:                true,
		AlwaysOnTop:              true,
		Hidden:                   true,
		URL:                      "/flash",
		BackgroundType:           application.BackgroundTypeTransparent,
		ContentProtectionEnabled: true,
		HideOnEscape:             true,
		DisableResize:            true,
		Windows: application.WindowsWindow{
			Theme:           application.Dark,
			HiddenOnTaskbar: true,
		},
	})
	windowService.SetWindow("main", mainWindow)
	windowService.SetWindow("popover", popoverWindow)
	windowService.SetWindow("flash", flashWindow)

	setupTray(app, mainWindow, windowService, appService)
	if settings, err := settingsService.Get(); err == nil {
		_ = shortcutService.Register(settings.Shortcuts)
	}

	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}

func setupTray(app *application.App, mainWindow application.Window, windows *services.WindowService, appService *services.AppService) {
	tray := app.SystemTray.New()
	tray.SetTooltip("Hat Flash")
	tray.OnClick(func() {
		mainWindow.Show()
		mainWindow.Focus()
	})

	menu := app.Menu.New()
	menu.Add("Show Hat Flash").OnClick(func(ctx *application.Context) {
		mainWindow.Show()
		mainWindow.Focus()
	})
	menu.Add("Toggle Popover").OnClick(func(ctx *application.Context) {
		windows.TogglePopover()
	})
	menu.AddSeparator()
	menu.Add("Quit").OnClick(func(ctx *application.Context) {
		appService.Quit()
	})
	tray.SetMenu(menu)
}
