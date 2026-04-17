package user

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	svc     *Service
	godWallet string // only this wallet can access admin endpoints
}

func NewAdminHandler(svc *Service, godWallet string) *AdminHandler {
	return &AdminHandler{svc: svc, godWallet: godWallet}
}

// GET /api/admin/kyc/pending?limit=20&offset=0
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

	subs, err := h.svc.kycRepo.FindPendingManual(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}

	items := make([]AdminKYCItem, 0, len(subs))
	for _, s := range subs {
		item := AdminKYCItem{
			SubmissionID:  s.ID,
			WalletAddress: s.WalletAddress,
			ReviewStatus:  s.ReviewStatus,
			OCRSuccess:    s.OCRSuccess,
			SubmittedAt:   s.SubmittedAt.Format("2006-01-02T15:04:05Z"),
		}
		if s.OCRName.Valid {
			v := s.OCRName.String
			item.OCRName = &v
		}
		if s.OCRAddress.Valid {
			v := s.OCRAddress.String
			item.OCRAddress = &v
		}
		if s.FaceMatchScore.Valid {
			v := s.FaceMatchScore.Float64
			item.FaceMatchScore = &v
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// PUT /api/admin/kyc/:id/review
func (h *AdminHandler) ReviewSubmission(c *gin.Context) {
	if !h.isAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "forbidden"})
		return
	}

	idStr := c.Param("id")
	subID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid submission id"})
		return
	}

	var req AdminReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}

	adminWallet := getWallet(c)
	if err := h.svc.AdminReview(c.Request.Context(), subID, req.Action, req.Note, adminWallet); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "review submitted"})
}

func (h *AdminHandler) isAdmin(c *gin.Context) bool {
	if h.godWallet == "" {
		return false
	}
	wallet := getWallet(c)
	return wallet != "" && wallet == h.godWallet
}
