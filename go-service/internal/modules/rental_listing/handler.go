package rental_listing

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(propertyID int64, wallet string, req CreateRentalListingRequest) (int64, error)
	ListPublic() ([]*model.RentalListing, error)
	GetByID(id int64) (*model.RentalListing, error)
	Update(id int64, wallet string, req UpdateRentalListingRequest) error
	Publish(id int64, wallet string, durationDays int) error
	Close(id int64, wallet string) error
}

type Handler struct{ svc APIService }

func NewHandler(svc APIService) *Handler { return &Handler{svc: svc} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func (h *Handler) ListPublic(c *gin.Context) {
	rls, err := h.svc.ListPublic()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	resp := make([]RentalListingResponse, 0, len(rls))
	for _, rl := range rls {
		resp = append(resp, toResponse(rl))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	rl, err := h.svc.GetByID(id)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(rl)})
}

func (h *Handler) Create(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	var req CreateRentalListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.Create(propID, walletFrom(c), req)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req UpdateRentalListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Update(id, walletFrom(c), req); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "updated"})
}

func (h *Handler) Publish(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req struct {
		DurationDays int `json:"duration_days" binding:"required,min=7"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Publish(id, walletFrom(c), req.DurationDays); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "published"})
}

func (h *Handler) Close(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := h.svc.Close(id, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "closed"})
}

func toResponse(rl *model.RentalListing) RentalListingResponse {
	resp := RentalListingResponse{
		ID: rl.ID, PropertyID: rl.PropertyID,
		Status: rl.Status, DurationDays: rl.DurationDays,
		MonthlyRent: rl.MonthlyRent, DepositMonths: rl.DepositMonths,
		ManagementFeePayer: rl.ManagementFeePayer, MinLeaseMonths: rl.MinLeaseMonths,
		AllowPets: rl.AllowPets, AllowCooking: rl.AllowCooking,
		CreatedAt: rl.CreatedAt, UpdatedAt: rl.UpdatedAt,
	}
	if rl.GenderRestriction.Valid {
		resp.GenderRestriction = &rl.GenderRestriction.String
	}
	if rl.Notes.Valid {
		resp.Notes = &rl.Notes.String
	}
	if rl.PublishedAt.Valid {
		resp.PublishedAt = &rl.PublishedAt.Time
	}
	if rl.ExpiresAt.Valid {
		resp.ExpiresAt = &rl.ExpiresAt.Time
	}
	return resp
}

func handleErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrPropertyNotReady):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
	}
}
