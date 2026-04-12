package auth

import (
	"net/http"
	"strings"
	"time"

	"go-service/internal/config"
	"go-service/internal/repository"

	"github.com/gin-gonic/gin"
)

func OptionalAuthMiddleware(sessionRepository *repository.SessionRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		cfg := config.LoadSIWEConfig()

		secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

		cookieConfig := SessionCookieConfig{
			Name:     cfg.AuthCookieName,
			Path:     "/",
			Secure:   secureCookie,
			SameSite: http.SameSiteLaxMode,
		}

		sessionToken, err := GetSessionTokenFromCookie(c, cookieConfig)
		if err != nil || sessionToken == "" {
			c.Next()
			return
		}

		session, err := sessionRepository.GetByToken(sessionToken)
		if err != nil || session == nil {
			c.Next()
			return
		}

		if session.Revoked {
			c.Next()
			return
		}

		if time.Now().UTC().After(session.ExpiredAt) {
			c.Next()
			return
		}

		c.Set(ContextSessionToken, session.SessionToken)
		c.Set(ContextWalletAddress, session.WalletAddress)
		c.Set(ContextChainID, session.ChainID)

		c.Next()
	}
}
