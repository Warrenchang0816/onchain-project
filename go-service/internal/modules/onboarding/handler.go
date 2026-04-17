package onboarding

import (
    "errors"
    "mime/multipart"
    "net/http"
    "strings"

    "github.com/ethereum/go-ethereum/common"
    "github.com/gin-gonic/gin"

    platformauth "go-service/internal/platform/auth"
    "go-service/internal/platform/config"
)

type Handler struct {
    svc *Service
}

func NewHandler(svc *Service) *Handler {
    return &Handler{svc: svc}
}

// POST /api/onboard/email/request-otp
func (h *Handler) RequestEmailOTP(c *gin.Context) {
    var req RequestEmailOTPRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    resp, err := h.svc.RequestEmailOTP(strings.ToLower(strings.TrimSpace(req.Email)))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, resp)
}

// POST /api/onboard/email/verify-otp
func (h *Handler) VerifyEmailOTP(c *gin.Context) {
    var req VerifyEmailOTPRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    sess, isResume, err := h.svc.VerifyEmailOTP(strings.ToLower(strings.TrimSpace(req.Email)), req.Code)
    if err != nil {
        var emailUsed *ErrEmailAlreadyUsed
        if errors.As(err, &emailUsed) {
            c.JSON(http.StatusConflict, gin.H{
                "error":      emailUsed.Error(),
                "error_code": "EMAIL_ALREADY_USED",
                "id_hint":    emailUsed.IDHint,
            })
            return
        }
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    resp := VerifyEmailOTPResponse{
        SessionID: sess.ID,
        Step:      sess.Step,
        IsResume:  isResume,
    }
    if isResume {
        resp.OCRName = nullableStr(sess.ConfirmedName)
        resp.OCRBirthDate = nullableStr(sess.ConfirmedBirthDate)
        resp.OCRAddress = nullableStr(sess.OCRAddress)
        resp.IDNumberHint = nullableStr(sess.OCRIDNumberHint)
    }
    c.JSON(http.StatusOK, resp)
}

// POST /api/onboard/session/restart
func (h *Handler) RestartSession(c *gin.Context) {
    var req RestartSessionRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    sess, err := h.svc.StartNewSession(req.SessionID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, VerifyEmailOTPResponse{SessionID: sess.ID, Step: sess.Step})
}

// POST /api/onboard/phone/request-otp
func (h *Handler) RequestPhoneOTP(c *gin.Context) {
    var req RequestPhoneOTPRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := h.svc.RequestPhoneOTP(req.SessionID, strings.TrimSpace(req.Phone)); err != nil {
        var phoneUsed *ErrPhoneAlreadyUsed
        if errors.As(err, &phoneUsed) {
            c.JSON(http.StatusConflict, gin.H{
                "error":      phoneUsed.Error(),
                "error_code": "PHONE_ALREADY_USED",
                "id_hint":    phoneUsed.IDHint,
            })
            return
        }
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, OKResponse{OK: true, Message: "驗證碼已發送至 " + req.Phone})
}

// POST /api/onboard/phone/verify-otp
func (h *Handler) VerifyPhoneOTP(c *gin.Context) {
    var req VerifyPhoneOTPRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := h.svc.VerifyPhoneOTP(req.SessionID, strings.TrimSpace(req.Phone), req.Code); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, OKResponse{OK: true, Message: "手機驗證完成"})
}

// POST /api/onboard/kyc/upload
// Fields: session_id, stage=id_card|second_doc|selfie|full, id_front, id_back, selfie, second_doc
func (h *Handler) UploadKYCDocuments(c *gin.Context) {
    sessionID := strings.TrimSpace(c.PostForm("session_id"))
    if sessionID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
        return
    }
    stage := strings.TrimSpace(c.PostForm("stage"))
    if stage == "" {
        stage = "full"
    }

    idFrontData, err := readOptionalFormFile(c, "id_front")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "id_front: " + err.Error()})
        return
    }
    idBackData, err := readOptionalFormFile(c, "id_back")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "id_back: " + err.Error()})
        return
    }
    selfieData, err := readOptionalFormFile(c, "selfie")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "selfie: " + err.Error()})
        return
    }
    secondDocData, err := readOptionalFormFile(c, "second_doc")
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "second_doc: " + err.Error()})
        return
    }

    resp, err := h.svc.UploadKYCDocuments(c.Request.Context(), stage, sessionID, idFrontData, idBackData, selfieData, secondDocData)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, resp)
}

// POST /api/onboard/kyc/confirm
func (h *Handler) ConfirmKYCData(c *gin.Context) {
    var req ConfirmKYCDataRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if err := h.svc.ConfirmKYCData(req.SessionID, strings.TrimSpace(req.ConfirmedName), strings.TrimSpace(req.ConfirmedBirthDate)); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, OKResponse{OK: true, Message: "KYC 資料確認完成"})
}

// POST /api/onboard/wallet/message
func (h *Handler) WalletMessage(c *gin.Context) {
    var req WalletMessageRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if !common.IsHexAddress(req.WalletAddress) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
        return
    }
    checksumAddr := common.HexToAddress(req.WalletAddress).Hex()
    msg, err := h.svc.BuildWalletMessage(req.SessionID, checksumAddr)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, WalletMessageResponse{Message: msg})
}

// POST /api/onboard/wallet/bind
func (h *Handler) BindWallet(c *gin.Context) {
    var req BindWalletRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    if !common.IsHexAddress(req.WalletAddress) {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid wallet address"})
        return
    }
    req.WalletAddress = common.HexToAddress(req.WalletAddress).Hex()

    resp, err := h.svc.BindWallet(c.Request.Context(), req)
    if err != nil {
        var alreadyBound *ErrWalletAlreadyBound
        if errors.As(err, &alreadyBound) {
            c.JSON(http.StatusConflict, gin.H{
                "error":      "此錢包已完成身份綁定，若非本人操作請聯絡客服",
                "error_code": "WALLET_ALREADY_BOUND",
                "id_hint":    alreadyBound.IDHint,
            })
            return
        }
        var identityUsed *ErrIdentityAlreadyUsed
        if errors.As(err, &identityUsed) {
            c.JSON(http.StatusConflict, gin.H{
                "error":      "此身分證字號已完成 KYC 綁定，若非本人操作請聯絡客服",
                "error_code": "IDENTITY_ALREADY_USED",
                "id_hint":    identityUsed.IDHint,
            })
            return
        }
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    cfg := config.LoadSIWEConfig()
    cookieConfig := platformauth.SessionCookieConfig{
        Name:     cfg.AuthCookieName,
        Path:     "/",
        Secure:   strings.EqualFold(cfg.AuthSessionSecure, "true"),
        SameSite: http.SameSiteLaxMode,
    }
    platformauth.SetSessionCookie(c, cookieConfig, resp.SessionToken, resp.SessionExpiry)

    c.JSON(http.StatusOK, gin.H{
        "wallet_address": resp.WalletAddress,
        "kyc_status":     resp.KYCStatus,
        "message":        resp.Message,
    })
}

func readOptionalFormFile(c *gin.Context, field string) ([]byte, error) {
    fh, err := c.FormFile(field)
    if err != nil {
        if err == http.ErrMissingFile {
            return nil, nil
        }
        return nil, err
    }
    return readFileHeader(fh)
}

func readFileHeader(fh *multipart.FileHeader) ([]byte, error) {
    f, err := fh.Open()
    if err != nil {
        return nil, err
    }
    defer f.Close()
    buf := make([]byte, fh.Size)
    _, err = f.Read(buf)
    return buf, err
}
