package credential

import (
	"io"
	"net/http"
	"strconv"

	"go-service/internal/platform/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetMyCredentials(c *gin.Context) {
	resp, err := h.svc.GetMyCredentials(getWallet(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) CreateSubmission(c *gin.Context) {
	var req CreateSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "請提供身份申請資料"})
		return
	}

	resp, err := h.svc.CreateSubmission(c.Request.Context(), getWallet(c), c.Param("type"), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "身份申請已建立", "data": resp})
}

func (h *Handler) UploadFiles(c *gin.Context) {
	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	mainDocData, err := readFormFile(c, "main_doc")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "main_doc file required: " + err.Error()})
		return
	}

	supportDocData, err := readOptionalFormFile(c, "support_doc")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "support_doc file invalid: " + err.Error()})
		return
	}

	if err := h.svc.UploadFiles(c.Request.Context(), getWallet(c), c.Param("type"), submissionID, mainDocData, supportDocData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "身份文件已上傳"})
}

func (h *Handler) AnalyzeSubmission(c *gin.Context) {
	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	resp, err := h.svc.AnalyzeSubmission(c.Request.Context(), getWallet(c), c.Param("type"), submissionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) RequestManualReview(c *gin.Context) {
	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	resp, err := h.svc.RequestManualReview(c.Request.Context(), getWallet(c), c.Param("type"), submissionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已送交人工審核", "data": resp})
}

func (h *Handler) ActivateSubmission(c *gin.Context) {
	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	if err := h.svc.ActivateSubmission(c.Request.Context(), getWallet(c), c.Param("type"), submissionID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "身份憑證已啟用"})
}

func getWallet(c *gin.Context) string {
	value, _ := c.Get(auth.ContextWalletAddress)
	wallet, _ := value.(string)
	return wallet
}

func parseSubmissionID(raw string) (int64, error) {
	return strconv.ParseInt(raw, 10, 64)
}

func readFormFile(c *gin.Context, fieldName string) ([]byte, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return nil, err
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return io.ReadAll(file)
}

func readOptionalFormFile(c *gin.Context, fieldName string) ([]byte, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return nil, nil
	}
	file, err := fileHeader.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return io.ReadAll(file)
}
