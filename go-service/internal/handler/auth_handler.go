package handler

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go-service/internal/auth"
	"go-service/internal/config"
	"go-service/internal/repository"

	"github.com/gin-gonic/gin"
	siwe "github.com/spruceid/siwe-go"

	"log"

	"github.com/ethereum/go-ethereum/common"
)

type AuthHandler struct {
	nonceRepository   *repository.NonceRepository
	sessionRepository *repository.SessionRepository
	sessionCookie     auth.SessionCookieConfig
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	nonceRepo := repository.NewNonceRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	return &AuthHandler{
		nonceRepository:   nonceRepo,
		sessionRepository: sessionRepo,
		sessionCookie: auth.SessionCookieConfig{
			Name:     "go_service_session",
			Path:     "/",
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
		},
	}
}

type SIWEMessageRequest struct {
	Address string `json:"address"`
}

type SIWEMessageResponse struct {
	Message string `json:"message"`
}

type SIWEVerifyRequest struct {
	Message   string `json:"message"`
	Signature string `json:"signature"`
	Address   string `json:"address"`
}

type SIWEVerifyResponse struct {
	Authenticated bool   `json:"authenticated"`
	Address       string `json:"address"`
}

type AuthMeResponse struct {
	Authenticated    bool   `json:"authenticated"`
	Address          string `json:"address,omitempty"`
	ChainID          string `json:"chainId,omitempty"`
	IsPlatformWallet bool   `json:"isPlatformWallet"`
}

type AuthLogoutResponse struct {
	Success bool `json:"success"`
}

func (h *AuthHandler) SIWEMessageHandler(c *gin.Context) {
	var req SIWEMessageRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	if req.Address == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "address is required",
		})
		return
	}

	if !common.IsHexAddress(req.Address) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid wallet address",
		})
		return
	}

	checksumAddress := common.HexToAddress(req.Address).Hex()

	nonce, err := auth.GenerateNonce()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate nonce",
		})
		return
	}

	cfg := config.LoadSIWEConfig()

	nonceExpireSeconds, err := strconv.Atoi(cfg.NonceExpire)
	if err != nil {
		nonceExpireSeconds = 300
	}

	expiredAt := time.Now().UTC().Add(time.Duration(nonceExpireSeconds) * time.Second)

	if err := h.nonceRepository.Create(checksumAddress, nonce, expiredAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to save nonce",
		})
		return
	}

	message := auth.BuildSIWEMessage(checksumAddress, nonce, cfg)

	c.JSON(http.StatusOK, SIWEMessageResponse{
		Message: message,
	})
}

func (h *AuthHandler) SIWEVerifyHandler(c *gin.Context) {
	log.Println("SIWEVerifyHandler called")
	var req SIWEVerifyRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
		})
		return
	}

	if !common.IsHexAddress(req.Address) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid wallet address",
		})
		return
	}

	checksumAddress := common.HexToAddress(req.Address).Hex()

	log.Println("verify address:", req.Address)
	log.Println("verify message:", req.Message)
	log.Println("verify signature:", req.Signature)

	if req.Message == "" || req.Signature == "" || req.Address == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "message, signature, and address are required",
		})
		return
	}

	cfg := config.LoadSIWEConfig()

	message, err := siwe.ParseMessage(req.Message)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid siwe message",
		})
		return
	}

	if message.GetAddress().String() != checksumAddress {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "address does not match siwe message",
		})
		return
	}

	nonceRecord, err := h.nonceRepository.FindLatestByWalletAddress(checksumAddress)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "nonce not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to query nonce",
		})
		return
	}

	if nonceRecord.Used {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "nonce already used",
		})
		return
	}

	if time.Now().UTC().After(nonceRecord.ExpiredAt) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "nonce expired",
		})
		return
	}

	expectedDomain := cfg.AppDomain
	expectedNonce := nonceRecord.Nonce
	log.Println("expectedDomain:", expectedDomain)
	log.Println("message domain:", message.GetDomain())

	_, err = message.Verify(
		req.Signature,
		&expectedDomain,
		&expectedNonce,
		nil,
	)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "signature verification failed",
		})
		return
	}

	if err := h.nonceRepository.MarkUsed(nonceRecord.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update nonce",
		})
		return
	}

	sessionExpireSeconds, err := strconv.Atoi(cfg.AuthSessionExpire)
	if err != nil {
		sessionExpireSeconds = 86400
	}

	sessionExpiredAt := time.Now().UTC().Add(time.Duration(sessionExpireSeconds) * time.Second)

	sessionToken, err := h.sessionRepository.Create(checksumAddress, cfg.SIWEChainID, sessionExpiredAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to create session",
		})
		return
	}

	secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

	cookieConfig := auth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	auth.SetSessionCookie(c, cookieConfig, sessionToken, sessionExpiredAt)

	c.JSON(http.StatusOK, SIWEVerifyResponse{
		Authenticated: true,
		Address:       checksumAddress,
	})
}

func (h *AuthHandler) AuthMeHandler(c *gin.Context) {
	cfg := config.LoadSIWEConfig()

	secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

	cookieConfig := auth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	sessionToken, err := auth.GetSessionTokenFromCookie(c, cookieConfig)
	if err != nil {
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	session, err := h.sessionRepository.GetByToken(sessionToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to query session",
		})
		return
	}

	if session == nil {
		auth.ClearSessionCookie(c, cookieConfig)
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	if session.Revoked {
		auth.ClearSessionCookie(c, cookieConfig)
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	if time.Now().UTC().After(session.ExpiredAt) {
		auth.ClearSessionCookie(c, cookieConfig)
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	blockchainCfg := config.LoadBlockchainConfig()
	isPlatformWallet := strings.EqualFold(session.WalletAddress, blockchainCfg.PlatformTreasuryAddr)

	c.JSON(http.StatusOK, AuthMeResponse{
		Authenticated:    true,
		Address:          session.WalletAddress,
		ChainID:          session.ChainID,
		IsPlatformWallet: isPlatformWallet,
	})
}

func (h *AuthHandler) AuthLogoutHandler(c *gin.Context) {
	cfg := config.LoadSIWEConfig()

	secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

	cookieConfig := auth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	sessionToken, err := auth.GetSessionTokenFromCookie(c, cookieConfig)
	if err == nil {
		if err := h.sessionRepository.Revoke(sessionToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to revoke session",
			})
			return
		}
	}

	auth.ClearSessionCookie(c, cookieConfig)

	c.JSON(http.StatusOK, AuthLogoutResponse{
		Success: true,
	})
}

func (h *AuthHandler) GetSessionRepository() *repository.SessionRepository {
	return h.sessionRepository
}
