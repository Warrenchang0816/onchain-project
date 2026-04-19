package auth

import (
	"math/rand"
	"net/http"
	"strings"
	"time"

	"go-service/internal/db/repository"
	"go-service/internal/platform/notify"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type ResetPasswordHandler struct {
	userRepo    *repository.UserRepository
	otpRepo     *repository.OTPRepository
	emailSender *notify.EmailSender
}

func NewResetPasswordHandler(
	userRepo *repository.UserRepository,
	otpRepo *repository.OTPRepository,
	emailSender *notify.EmailSender,
) *ResetPasswordHandler {
	return &ResetPasswordHandler{userRepo: userRepo, otpRepo: otpRepo, emailSender: emailSender}
}

type ResetRequestOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetSetPasswordRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Code     string `json:"code"     binding:"required,len=6"`
	Password string `json:"password" binding:"required"`
}

// POST /api/auth/reset-password/request-otp
func (h *ResetPasswordHandler) RequestOTP(c *gin.Context) {
	var req ResetRequestOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))

	user, err := h.userRepo.FindByEmail(email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查詢失敗"})
		return
	}
	if user == nil {
		// Don't leak existence; return OK anyway
		c.JSON(http.StatusOK, gin.H{"ok": true, "message": "若此 Email 已完成 KYC，驗證碼將發送至信箱"})
		return
	}

	// Rate limit: 60 s
	latest, _ := h.otpRepo.LatestCreatedAt(email, "email")
	if !latest.IsZero() && time.Since(latest) < 60*time.Second {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "請稍後再試（60 秒內限發一次）"})
		return
	}

	code := randomOTP()
	exp := time.Now().UTC().Add(10 * time.Minute)
	if err := h.otpRepo.Create(email, "email", code, nil, exp); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "建立驗證碼失敗"})
		return
	}
	if err := h.emailSender.SendOTP(email, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "發送驗證碼失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "驗證碼已發送至信箱"})
}

// POST /api/auth/reset-password/set-password
func (h *ResetPasswordHandler) SetPassword(c *gin.Context) {
	var req ResetSetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密碼至少需要 8 個字元"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))

	ok, err := h.otpRepo.Verify(email, "email", req.Code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "驗證失敗"})
		return
	}
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "驗證碼錯誤或已失效"})
		return
	}

	user, err := h.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到此 Email 對應的帳號"})
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

func randomOTP() string {
	const digits = "0123456789"
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, 6)
	for i := range b {
		b[i] = digits[r.Intn(len(digits))]
	}
	return string(b)
}
