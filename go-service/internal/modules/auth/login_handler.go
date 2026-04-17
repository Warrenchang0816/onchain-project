package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	siwe "github.com/spruceid/siwe-go"
	"golang.org/x/crypto/bcrypt"

	"go-service/internal/db/repository"
	platformauth "go-service/internal/platform/auth"
	"go-service/internal/platform/config"

	"github.com/gin-gonic/gin"
)

// LoginHandler handles identity-based login (ID hash + wallet SIWE + password)
// and password management.
type LoginHandler struct {
	userRepo    *repository.UserRepository
	sessionRepo *repository.SessionRepository
	nonceRepo   *repository.NonceRepository
	siweCfg     *config.SIWEConfig
}

func NewLoginHandler(
	userRepo *repository.UserRepository,
	sessionRepo *repository.SessionRepository,
	nonceRepo *repository.NonceRepository,
	siweCfg *config.SIWEConfig,
) *LoginHandler {
	return &LoginHandler{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		nonceRepo:   nonceRepo,
		siweCfg:     siweCfg,
	}
}

// LoginRequest is the identity-based login payload.
// person_hash = SHA-256(id_number.toUpperCase()) — computed in the browser, never raw ID.
type LoginRequest struct {
	PersonHash    string `json:"person_hash"    binding:"required"`
	SIWEMessage   string `json:"siwe_message"   binding:"required"`
	SIWESignature string `json:"siwe_signature" binding:"required"`
	Password      string `json:"password"       binding:"required"`
}

type LoginResponse struct {
	Authenticated bool   `json:"authenticated"`
	Address       string `json:"address"`
	Email         string `json:"email"`
	KYCStatus     string `json:"kycStatus"`
}

type SetPasswordRequest struct {
	WalletAddress string `json:"wallet_address" binding:"required"`
	Password      string `json:"password"       binding:"required"`
}

// POST /api/auth/login
// Verifies: identity_hash (SHA-256(person_hash + lower(wallet))) + SIWE sig + bcrypt password.
func (h *LoginHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所有欄位為必填"})
		return
	}

	// ── 1. Parse SIWE message to get wallet address ──────────
	parsed, err := siwe.ParseMessage(req.SIWEMessage)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("SIWE 訊息解析失敗: %v", err)})
		return
	}
	walletAddress := parsed.GetAddress().Hex() // EIP-55 checksum form

	// ── 2. Verify SIWE nonce + signature ─────────────────────
	if err := h.verifySIWE(walletAddress, req.SIWEMessage, req.SIWESignature); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("錢包簽名驗證失敗: %v", err)})
		return
	}

	// ── 3. Look up user by person_hash ───────────────────────
	// person_hash is the stable identity key (SHA-256 of id_number).
	// The wallet is only an authentication factor — not part of the identity key.
	user, err := h.userRepo.FindByPersonHash(req.PersonHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查詢失敗"})
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "身分證字號不符，帳號不存在"})
		return
	}

	// ── 3b. Verify the SIWE wallet matches this user's registered wallet ──
	if !strings.EqualFold(user.WalletAddress, walletAddress) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "錢包地址與帳號不符"})
		return
	}

	// ── 4. Verify password ────────────────────────────────────
	if !user.PasswordHash.Valid || user.PasswordHash.String == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "尚未設定密碼，請先完成 KYC 註冊"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密碼錯誤"})
		return
	}

	// ── 5. Create session ─────────────────────────────────────
	sessionTTL := 86400
	sessionExpiredAt := time.Now().UTC().Add(time.Duration(sessionTTL) * time.Second)
	sessionToken, err := h.sessionRepo.Create(user.WalletAddress, h.siweCfg.SIWEChainID, sessionExpiredAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "建立 session 失敗"})
		return
	}

	secureCookie := strings.EqualFold(h.siweCfg.AuthSessionSecure, "true")
	cookieConfig := platformauth.SessionCookieConfig{
		Name:     h.siweCfg.AuthCookieName,
		Path:     "/",
		Secure:   secureCookie,
		SameSite: http.SameSiteLaxMode,
	}
	platformauth.SetSessionCookieSessionOnly(c, cookieConfig, sessionToken)

	email := ""
	if user.Email.Valid {
		email = user.Email.String
	}

	c.JSON(http.StatusOK, LoginResponse{
		Authenticated: true,
		Address:       user.WalletAddress,
		Email:         email,
		KYCStatus:     user.KYCStatus,
	})
}

// POST /api/auth/password/set  (called after onboarding completes, no auth required)
func (h *LoginHandler) SetPassword(c *gin.Context) {
	var req SetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wallet_address 與 password 為必填"})
		return
	}

	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密碼至少需要 8 個字元"})
		return
	}

	user, err := h.userRepo.FindByWallet(req.WalletAddress)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查詢失敗"})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到此錢包對應的帳號，請先完成 KYC"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密碼處理失敗"})
		return
	}

	if err := h.userRepo.SetPassword(user.ID, string(hash)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "儲存密碼失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "密碼設定成功，請使用身分證字號 + 錢包 + 密碼登入"})
}

// ChangeWalletRequest is the payload for switching a registered wallet address.
type ChangeWalletRequest struct {
	NewSIWEMessage   string `json:"new_siwe_message"   binding:"required"`
	NewSIWESignature string `json:"new_siwe_signature" binding:"required"`
	Password         string `json:"password"           binding:"required"`
}

// POST /api/auth/wallet/change  (requires active session)
// Verifies current session identity + password, then updates wallet_address to the new wallet.
func (h *LoginHandler) ChangeWallet(c *gin.Context) {
	currentWallet, _ := c.Get("walletAddress")
	currentWalletStr, _ := currentWallet.(string)
	if currentWalletStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "session 無效"})
		return
	}

	var req ChangeWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "所有欄位為必填"})
		return
	}

	// ── 1. Parse new SIWE to get new wallet address ───────────
	parsed, err := siwe.ParseMessage(req.NewSIWEMessage)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("SIWE 訊息解析失敗: %v", err)})
		return
	}
	newWallet := parsed.GetAddress().Hex()

	if strings.EqualFold(currentWalletStr, newWallet) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "新錢包與目前綁定的錢包相同"})
		return
	}

	// ── 2. Verify new wallet SIWE signature ───────────────────
	if err := h.verifySIWE(newWallet, req.NewSIWEMessage, req.NewSIWESignature); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("新錢包簽名驗證失敗: %v", err)})
		return
	}

	// ── 3. Verify new wallet is not already taken ─────────────
	existing, err := h.userRepo.FindByWallet(newWallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查詢失敗"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "此錢包已被其他帳號使用"})
		return
	}

	// ── 4. Load current user and verify password ──────────────
	user, err := h.userRepo.FindByWallet(currentWalletStr)
	if err != nil || user == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查詢使用者失敗"})
		return
	}
	if !user.PasswordHash.Valid || user.PasswordHash.String == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "尚未設定密碼"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "密碼錯誤"})
		return
	}

	// ── 5. Update wallet address ──────────────────────────────
	if err := h.userRepo.UpdateWalletAddress(user.ID, newWallet); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新錢包失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "new_wallet": newWallet, "message": "錢包已成功切換，請重新登入"})
}

// verifySIWE validates the SIWE signature against the stored nonce.
func (h *LoginHandler) verifySIWE(walletAddress, message, signature string) error {
	parsed, err := siwe.ParseMessage(message)
	if err != nil {
		return fmt.Errorf("parse SIWE message: %w", err)
	}
	nonce := parsed.GetNonce()

	nonceRecord, err := h.nonceRepo.FindLatestByWalletAddress(walletAddress)
	if err != nil {
		return errors.New("nonce 查詢失敗")
	}
	if nonceRecord == nil {
		return errors.New("找不到 nonce，請重新連接錢包")
	}
	if nonceRecord.Used || time.Now().UTC().After(nonceRecord.ExpiredAt) {
		return errors.New("nonce 已過期或已使用，請重新連接錢包")
	}

	domain := h.siweCfg.AppDomain
	if _, err := parsed.Verify(signature, &domain, &nonce, nil); err != nil {
		return fmt.Errorf("簽名驗證失敗: %w", err)
	}
	_ = h.nonceRepo.MarkUsed(nonceRecord.ID)
	return nil
}
