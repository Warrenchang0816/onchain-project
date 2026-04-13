package auth

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	platformauth "go-service/internal/platform/auth"
	"go-service/internal/platform/config"
	"go-service/internal/db/repository"

	"github.com/gin-gonic/gin"
	siwe "github.com/spruceid/siwe-go"

	"log"

	"github.com/ethereum/go-ethereum/common"
)

type Handler struct {
	nonceRepository   *repository.NonceRepository
	sessionRepository *repository.SessionRepository
	sessionCookie     platformauth.SessionCookieConfig
}

func NewHandler(nonceRepo *repository.NonceRepository, sessionRepo *repository.SessionRepository) *Handler {
	return &Handler{
		nonceRepository:   nonceRepo,
		sessionRepository: sessionRepo,
		sessionCookie: platformauth.SessionCookieConfig{
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

func (h *Handler) SIWEMessageHandler(c *gin.Context) {
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

	nonce, err := platformauth.GenerateNonce()
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

	message := platformauth.BuildSIWEMessage(checksumAddress, nonce, cfg)

	c.JSON(http.StatusOK, SIWEMessageResponse{
		Message: message,
	})
}

func (h *Handler) SIWEVerifyHandler(c *gin.Context) {
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

	cookieConfig := platformauth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	platformauth.SetSessionCookie(c, cookieConfig, sessionToken, sessionExpiredAt)

	c.JSON(http.StatusOK, SIWEVerifyResponse{
		Authenticated: true,
		Address:       checksumAddress,
	})
}

func (h *Handler) AuthMeHandler(c *gin.Context) {
	cfg := config.LoadSIWEConfig()

	secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

	cookieConfig := platformauth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	sessionToken, err := platformauth.GetSessionTokenFromCookie(c, cookieConfig)
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
		platformauth.ClearSessionCookie(c, cookieConfig)
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	if session.Revoked {
		platformauth.ClearSessionCookie(c, cookieConfig)
		c.JSON(http.StatusOK, AuthMeResponse{
			Authenticated: false,
		})
		return
	}

	if time.Now().UTC().After(session.ExpiredAt) {
		platformauth.ClearSessionCookie(c, cookieConfig)
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

func (h *Handler) AuthLogoutHandler(c *gin.Context) {
	cfg := config.LoadSIWEConfig()

	secureCookie := strings.EqualFold(cfg.AuthSessionSecure, "true")

	cookieConfig := platformauth.SessionCookieConfig{
		Name:     cfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}

	sessionToken, err := platformauth.GetSessionTokenFromCookie(c, cookieConfig)
	if err == nil {
		if err := h.sessionRepository.Revoke(sessionToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "failed to revoke session",
			})
			return
		}
	}

	platformauth.ClearSessionCookie(c, cookieConfig)

	c.JSON(http.StatusOK, AuthLogoutResponse{
		Success: true,
	})
}
