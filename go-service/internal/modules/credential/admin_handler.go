package credential

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	svc       *Service
	godWallet string
}

func NewAdminHandler(svc *Service, godWallet string) *AdminHandler {
	return &AdminHandler{svc: svc, godWallet: godWallet}
}

func (h *AdminHandler) ListPendingManual(c *gin.Context) {
	if !h.isAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	items, err := h.svc.ListPendingManual(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

func (h *AdminHandler) ReviewSubmission(c *gin.Context) {
	if !h.isAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
		return
	}

	submissionID, err := parseSubmissionID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	var req AdminReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}

	if err := h.svc.ReviewSubmission(c.Request.Context(), submissionID, req.Action, req.Note, getWallet(c)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "審核結果已送出"})
}

func (h *AdminHandler) isAdmin(c *gin.Context) bool {
	if h.godWallet == "" {
		return false
	}
	return getWallet(c) == h.godWallet
}
