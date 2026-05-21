# Hat Flash

Separate macOS and Windows port with Wails v3, Go, React, TypeScript, Vite and a small Zustand store.

The backend stays the same: Firebase auth plus `hat-proxy` at `https://hat-proxy.joao02simi.workers.dev`.

## Shape

- `main.go`: Wails boot, windows, tray, service binding.
- `internal/controllers`: thin Wails API.
- `internal/services`: auth session, answer stream, clipboard, shortcuts, flash, updater.
- `internal/repositories`: settings and history JSON.
- `internal/models`: pure request/response/settings types.
- `frontend/src/pages`: `Main`, `Flash`.
- `frontend/src/bridge`: typed wrappers around generated Wails bindings.

Rule: controller thin, service owns behavior, repository owns disk, model owns data shape.

## Commands

```bash
go test ./...
cd frontend && npm test && npm run build
PATH="$HOME/go/bin:$PATH" wails3 build
```

Dev:

```bash
PATH="$HOME/go/bin:$PATH" wails3 dev
```

Firebase login needs:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_OAUTH_CLIENT_ID=
VITE_GOOGLE_OAUTH_CLIENT_SECRET=
```

## Native Surface

Implemented now:

- Google/Firebase token handoff to Go session.
- Google OAuth in desktop opens the system browser with a loopback callback.
- Chat streaming through `hat-proxy`.
- Text clipboard through Wails.
- Windows image clipboard path through a small Win32 `CF_DIB` reader.
- Flash window.
- Tray.
- Wails autostart hook.
- Settings persistence.
- Update check API placeholder.

Still needs manual proof before public release:

- Global hotkeys from background focus.
- Image clipboard against real Windows screenshots and copied browser images.
- Flash over full-screen apps on Windows and macOS.
- Updater provider wired to GitHub Releases.
