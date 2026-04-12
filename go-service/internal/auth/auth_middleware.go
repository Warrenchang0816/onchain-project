package auth

import (
	"net/http"
	"strings"
	"time"

	"go-service/internal/config"
	"go-service/internal/repository"

	"github.com/gin-gonic/gin"
)

const (
	ContextSessionToken  = "sessionToken"
	ContextWalletAddress = "walletAddress"
	ContextChainID       = "chainId"
)

func AuthMiddleware(sessionRepository *repository.SessionRepository) gin.HandlerFunc {
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
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "authentication required",
			})
			return
		}

		session, err := sessionRepository.GetByToken(sessionToken)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"error": "failed to query session",
			})
			return
		}

		if session == nil {
			ClearSessionCookie(c, cookieConfig)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid session",
			})
			return
		}

		if session.Revoked {
			ClearSessionCookie(c, cookieConfig)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "session revoked",
			})
			return
		}

		if time.Now().UTC().After(session.ExpiredAt) {
			ClearSessionCookie(c, cookieConfig)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "session expired",
			})
			return
		}

		c.Set(ContextSessionToken, session.SessionToken)
		c.Set(ContextWalletAddress, session.WalletAddress)
		c.Set(ContextChainID, session.ChainID)

		c.Next()
	}
}
