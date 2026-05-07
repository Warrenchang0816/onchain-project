package property

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
)

type APIService interface {
	ListMine(wallet string) ([]*model.Customer, error)
	GetForOwner(id int64, wallet string) (*model.Customer, error)
	UpdateDisclosureForOwner(id int64, wallet string, in DisclosureInput) error
	ConfirmDisclosureForOwner(id int64, wallet string) error
}

type Handler struct {
	svc APIService
}

func NewHandler(svc APIService) *Handler {
	return &Handler{svc: svc}
}

func walletFromContext(c *gin.Context) string {
	v, _ := c.Get("walletAddress")
	s, _ := v.(string)
	return s
}

func toPropertyResponse(p *model.Customer) PropertyResponse {
	resp := PropertyResponse{
		ID:                 p.ID,
		OwnerUserID:        p.OwnerUserID,
		Address:            p.Address,
		DeedNo:             p.DeedNo,
		DeedHash:           p.DeedHash,
		DisclosureHash:     p.DisclosureHash,
		VerificationStatus: p.VerificationStatus,
		CompletenessStatus: p.CompletenessStatus,
		CreatedAt:          p.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:          p.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if p.SourceCredentialSubmissionID.Valid {
		v := p.SourceCredentialSubmissionID.Int64
		resp.SourceCredentialSubmissionID = &v
	}
	if len(p.PropertyStatementJSON) > 0 {
		raw := json.RawMessage(p.PropertyStatementJSON)
		resp.PropertyStatementJSON = &raw
	}
	if len(p.WarrantyAnswersJSON) > 0 {
		raw := json.RawMessage(p.WarrantyAnswersJSON)
		resp.WarrantyAnswersJSON = &raw
	}
	if len(p.DisclosureSnapshotJSON) > 0 {
		raw := json.RawMessage(p.DisclosureSnapshotJSON)
		resp.DisclosureSnapshotJSON = &raw
	}
	return resp
}

func handlePropertyError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrPropertyNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrPropertyForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrDisclosureSnapshotRequired):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func (h *Handler) ListMyProperties(c *gin.Context) {
	properties, err := h.svc.ListMine(walletFromContext(c))
	if err != nil {
		handlePropertyError(c, err)
		return
	}
	resp := make([]PropertyResponse, 0, len(properties))
	for _, p := range properties {
		resp = append(resp, toPropertyResponse(p))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) GetProperty(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	p, err := h.svc.GetForOwner(id, walletFromContext(c))
	if err != nil {
		handlePropertyError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toPropertyResponse(p)})
}

func (h *Handler) UpdateDisclosure(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateDisclosureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	in := DisclosureInput{
		PropertyAddress:     req.PropertyAddress,
		OwnershipDocNo:      req.OwnershipDocNo,
		Statement:           req.Statement,
		Warranties:          req.Warranties,
		AttachmentSummaries: req.AttachmentSummaries,
	}
	if err := h.svc.UpdateDisclosureForOwner(id, walletFromContext(c), in); err != nil {
		handlePropertyError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *Handler) ConfirmDisclosure(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.ConfirmDisclosureForOwner(id, walletFromContext(c)); err != nil {
		handlePropertyError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
