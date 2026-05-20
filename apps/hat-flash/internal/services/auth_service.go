package services

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/JGSimi/Hat-Cross/apps/hat-flash/internal/models"
)

const oauthCallbackHTML = `<!DOCTYPE html>
<html lang="pt-br"><head>
<meta charset="utf-8">
<title>Hat Flash - Login concluido</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b0b0b;color:#f5f5f5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center;border:1px solid #2b2b2b;padding:32px 40px;background:#111}
h1{font-size:20px;margin:0 0 8px}
p{font-size:13px;color:#b8b8b8;margin:0}
</style></head>
<body><div class="box"><h1>Login concluido</h1><p>Pode fechar esta janela e voltar para o Hat Flash.</p></div></body></html>`

type externalURLOpener func(string) error

type AuthService struct {
	openURL externalURLOpener
	timeout time.Duration
}

func NewAuthService() *AuthService {
	return &AuthService{
		openURL: openExternalURL,
		timeout: 120 * time.Second,
	}
}

func NewAuthServiceWithOpener(openURL externalURLOpener, timeout time.Duration) *AuthService {
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	return &AuthService{openURL: openURL, timeout: timeout}
}

func (s *AuthService) RunGoogleLoopbackFlow(clientID string, state string, codeChallenge string) (models.OAuthFlowResult, error) {
	if clientID == "" {
		return models.OAuthFlowResult{}, errors.New("missing Google OAuth client id")
	}
	if state == "" {
		return models.OAuthFlowResult{}, errors.New("missing OAuth state")
	}
	if codeChallenge == "" {
		return models.OAuthFlowResult{}, errors.New("missing OAuth code challenge")
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return models.OAuthFlowResult{}, fmt.Errorf("start OAuth listener: %w", err)
	}

	redirectURI := fmt.Sprintf("http://127.0.0.1:%d/oauth/callback", listener.Addr().(*net.TCPAddr).Port)
	resultCh := make(chan oauthCallbackResult, 1)
	server := newOAuthCallbackServer(resultCh)

	go func() {
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			select {
			case resultCh <- oauthCallbackResult{err: fmt.Errorf("OAuth server failed: %w", err)}:
			default:
			}
		}
	}()

	authURL := buildGoogleAuthURL(clientID, redirectURI, state, codeChallenge)
	if err := s.openURL(authURL); err != nil {
		shutdownOAuthServer(server)
		return models.OAuthFlowResult{}, fmt.Errorf("open Google login: %w", err)
	}

	timer := time.NewTimer(s.timeout)
	defer timer.Stop()
	defer shutdownOAuthServer(server)

	select {
	case result := <-resultCh:
		if result.err != nil {
			return models.OAuthFlowResult{}, result.err
		}
		if result.state != state {
			return models.OAuthFlowResult{}, errors.New("OAuth state mismatch")
		}
		return models.OAuthFlowResult{Code: result.code, RedirectURI: redirectURI}, nil
	case <-timer.C:
		return models.OAuthFlowResult{}, errors.New("Google did not respond within 2 minutes")
	}
}

type oauthCallbackResult struct {
	code  string
	state string
	err   error
}

func newOAuthCallbackServer(resultCh chan<- oauthCallbackResult) *http.Server {
	var once sync.Once
	mux := http.NewServeMux()
	mux.HandleFunc("/oauth/callback", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(oauthCallbackHTML))

		query := r.URL.Query()
		result := oauthCallbackResult{
			code:  query.Get("code"),
			state: query.Get("state"),
		}
		if oauthError := query.Get("error"); oauthError != "" {
			result.err = fmt.Errorf("OAuth rejected: %s", html.EscapeString(oauthError))
		} else if result.code == "" {
			result.err = errors.New("OAuth callback missing code")
		} else if result.state == "" {
			result.err = errors.New("OAuth callback missing state")
		}

		once.Do(func() {
			resultCh <- result
		})
	})

	return &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
}

func buildGoogleAuthURL(clientID string, redirectURI string, state string, codeChallenge string) string {
	values := url.Values{}
	values.Set("client_id", clientID)
	values.Set("redirect_uri", redirectURI)
	values.Set("response_type", "code")
	values.Set("scope", "openid email profile")
	values.Set("state", state)
	values.Set("code_challenge", codeChallenge)
	values.Set("code_challenge_method", "S256")
	values.Set("prompt", "select_account")
	return "https://accounts.google.com/o/oauth2/v2/auth?" + values.Encode()
}

func shutdownOAuthServer(server *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func openExternalURL(rawURL string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", rawURL).Start()
	case "windows":
		return exec.Command("rundll32.exe", "url.dll,FileProtocolHandler", rawURL).Start()
	default:
		return exec.Command("xdg-open", rawURL).Start()
	}
}
