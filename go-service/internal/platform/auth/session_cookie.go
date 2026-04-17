package auth

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type SessionCookieConfig struct {
	Name     string
	Path     string
	Secure   bool
	SameSite http.SameSite
}

func SetSessionCookie(c *gin.Context, config SessionCookieConfig, sessionToken string, expiresAt time.Time) {
	maxAge := int(time.Until(expiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}

	cookie := &http.Cookie{
		Name:     config.Name,
		Value:    sessionToken,
		Path:     config.Path,
		HttpOnly: true,
		Secure:   config.Secure,
		SameSite: config.SameSite,
		Expires:  expiresAt,
		MaxAge:   maxAge,
	}

	http.SetCookie(c.Writer, cookie)
}

// SetSessionCookieSessionOnly sets a session-only cookie (no MaxAge / Expires).
// The browser clears it when the tab/window is closed.
func SetSessionCookieSessionOnly(c *gin.Context, config SessionCookieConfig, sessionToken string) {
	cookie := &http.Cookie{
		Name:     config.Name,
		Value:    sessionToken,
		Path:     config.Path,
		HttpOnly: true,
		Secure:   config.Secure,
		SameSite: config.SameSite,
	}
	http.SetCookie(c.Writer, cookie)
}

func ClearSessionCookie(c *gin.Context, config SessionCookieConfig) {
	cookie := &http.Cookie{
		Name:     config.Name,
		Value:    "",
		Path:     config.Path,
		HttpOnly: true,
		Secure:   config.Secure,
		SameSite: config.SameSite,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	}

	http.SetCookie(c.Writer, cookie)
}

func GetSessionTokenFromCookie(c *gin.Context, config SessionCookieConfig) (string, error) {
	cookie, err := c.Request.Cookie(config.Name)
	if err != nil {
		return "", err
	}

	sessionToken := strings.TrimSpace(cookie.Value)
	if sessionToken == "" {
		return "", errors.New("empty session cookie")
	}

	return sessionToken, nil
}
