# Hat

**A cross-platform AI assistant designed to stay out of your way.**

Hat is a native desktop application for macOS and Windows that provides contextual AI assistance without forcing users to leave what they are doing.

Instead of living in another browser tab, Hat stays available from the desktop and can quickly process text, clipboard content and contextual information.

## Highlights

- Cross-platform desktop application for **macOS and Windows**
- AI responses streamed directly into the desktop client
- Native system tray integration
- Google OAuth and Firebase authentication
- Clipboard integration
- Native Windows image clipboard support
- Persistent local settings and conversation history
- Background startup support
- Desktop-focused UI with a lightweight interaction model
- Automated build and release infrastructure

## Tech Stack

### Desktop
- **Go**
- **Wails v3**
- Native platform integrations

### Frontend
- **React**
- **TypeScript**
- **Vite**
- **Zustand**

### Backend & Infrastructure
- **Firebase Authentication**
- AI requests routed through a dedicated backend proxy
- **Cloudflare Workers**
- **Stripe** billing infrastructure
- GitHub Actions for builds and releases

## Architecture

The desktop application follows a layered architecture designed to keep platform-specific code isolated from business logic.

```text
apps/hat-flash/
├── internal/
│   ├── controllers/     # Wails API surface
│   ├── services/        # Application behavior
│   ├── repositories/    # Local persistence
│   └── models/          # Request, response and settings models
│
├── frontend/
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── services/
│       └── bridge/      # Typed interface with Wails bindings
│
└── main.go              # Desktop bootstrap, windows and tray
```

Controllers remain intentionally thin, while application behavior lives in services and persistence is isolated behind repositories.

## Native Integrations

Hat uses native desktop capabilities where browser applications cannot provide the same experience.

Current integrations include:

- System tray
- Desktop windows
- Clipboard access
- Windows image clipboard access through Win32
- System-browser OAuth flow with local callback
- Application autostart
- Local settings persistence

## Authentication

Authentication is handled using **Google OAuth + Firebase**.

The desktop OAuth flow opens the user's system browser and receives the authorization result through a local callback before transferring the authenticated session to the native application.

No production credentials are stored directly in the repository.

## AI Infrastructure

LLM requests are routed through the Hat backend rather than exposing provider credentials inside the desktop client.

This keeps provider API credentials server-side and separates the desktop application from the AI infrastructure.

## Development

### Requirements

- Go
- Node.js
- Wails v3

Install frontend dependencies and start development:

```bash
npm install
npm run dev
```

Run the complete test suite:

```bash
npm test
```

Build the desktop application:

```bash
npm run build
```

## Testing

The repository includes automated testing across multiple layers:

- React component and frontend tests
- Go tests
- Billing infrastructure tests
- Build environment validation
- Desktop smoke-test workflows

## Platforms

| Platform | Status |
| --- | --- |
| macOS Apple Silicon | Supported |
| macOS Intel | Supported |
| Windows x64 | Supported |

Pre-built releases are available through **GitHub Releases**.

## Why I Built It

Most AI assistants require switching applications, opening another tab or interrupting the current workflow.

Hat explores a different interaction model: an AI assistant that behaves more like an operating-system utility than a website.

The project also serves as an exploration of cross-platform desktop engineering, native OS integrations, authentication, AI infrastructure and shipping a complete software product.

## Author

**João Gabriel Simi de Oliveira**

Software Engineer focused on full-stack applications, desktop software, AI-powered products and automation.
