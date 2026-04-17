package user

import (
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/platform/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetKYCStatus(c *gin.Context) {
	wallet := getWallet(c)

	resp, err := h.svc.GetKYCStatus(wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) CreateKYCSubmission(c *gin.Context) {
	wallet := getWallet(c)
	var req CreateKYCSubmissionRequest
	_ = c.ShouldBindJSON(&req)

	resp, err := h.svc.CreateKYCSubmission(c.Request.Context(), wallet, req.DocumentType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) UploadKYCSubmissionDocuments(c *gin.Context) {
	wallet := getWallet(c)
	submissionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	idFrontData, err := readFormFile(c, "id_front")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "id_front file required: " + err.Error()})
		return
	}
	idBackData, err := readFormFile(c, "id_back")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "id_back file required: " + err.Error()})
		return
	}
	selfieData, err := readFormFile(c, "selfie")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "selfie file required: " + err.Error()})
		return
	}

	resp, err := h.svc.UploadKYCSubmissionDocuments(c.Request.Context(), wallet, submissionID, idFrontData, idBackData, selfieData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) AnalyzeKYCSubmission(c *gin.Context) {
	wallet := getWallet(c)
	submissionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	resp, err := h.svc.AnalyzeKYCSubmission(c.Request.Context(), wallet, submissionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) GetKYCSubmission(c *gin.Context) {
	wallet := getWallet(c)
	submissionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	resp, err := h.svc.GetKYCSubmission(c.Request.Context(), wallet, submissionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) GetProfile(c *gin.Context) {
	wallet := getWallet(c)
	resp, err := h.svc.GetProfile(wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) RequestEmailChangeOTP(c *gin.Context) {
	wallet := getWallet(c)
	var req RequestContactOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "newEmail is required"})
		return
	}
	if err := h.svc.RequestEmailChange(wallet, req.Value); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "驗證碼已發送至新 Email"})
}

func (h *Handler) VerifyEmailChange(c *gin.Context) {
	wallet := getWallet(c)
	var req VerifyEmailChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.VerifyEmailChange(wallet, req.NewEmail, req.OTP); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Email 已更新"})
}

func (h *Handler) RequestPhoneChangeOTP(c *gin.Context) {
	wallet := getWallet(c)
	var req RequestContactOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "newPhone is required"})
		return
	}
	if err := h.svc.RequestPhoneChange(wallet, req.Value); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "驗證碼已發送至新手機號碼"})
}

func (h *Handler) VerifyPhoneChange(c *gin.Context) {
	wallet := getWallet(c)
	var req VerifyPhoneChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.VerifyPhoneChange(wallet, req.NewPhone, req.OTP); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "手機號碼已更新"})
}

func (h *Handler) RequestMailingAddressOTP(c *gin.Context) {
	wallet := getWallet(c)
	var req RequestContactOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "channel is required"})
		return
	}
	if err := h.svc.RequestMailingAddressOTP(wallet, req.Channel); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "驗證碼已發送"})
}

func (h *Handler) UpdateMailingAddress(c *gin.Context) {
	wallet := getWallet(c)
	var req UpdateMailingAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.UpdateMailingAddress(wallet, req.Address, req.Channel, req.OTP); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "通訊地址已更新"})
}

func getWallet(c *gin.Context) string {
	v, _ := c.Get(auth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func readFormFile(c *gin.Context, fieldName string) ([]byte, error) {
	fh, err := c.FormFile(fieldName)
	if err != nil {
		return nil, err
	}
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return io.ReadAll(f)
}
