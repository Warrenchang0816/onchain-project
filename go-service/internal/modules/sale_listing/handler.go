package sale_listing

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(propertyID int64, wallet string, req CreateSaleListingRequest) (int64, error)
	ListPublic() ([]*model.SaleListing, error)
	GetByID(id int64) (*model.SaleListing, error)
	GetActiveByProperty(propertyID int64, wallet string) (*model.SaleListing, error)
	Update(id int64, wallet string, req UpdateSaleListingRequest) error
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
	sls, err := h.svc.ListPublic()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	resp := make([]SaleListingResponse, 0, len(sls))
	for _, sl := range sls {
		resp = append(resp, toResponse(sl))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	sl, err := h.svc.GetByID(id)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(sl)})
}

func (h *Handler) Create(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	var req CreateSaleListingRequest
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
	var req UpdateSaleListingRequest
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

func toResponse(sl *model.SaleListing) SaleListingResponse {
	resp := SaleListingResponse{
		ID: sl.ID, PropertyID: sl.PropertyID,
		Status: sl.Status, DurationDays: sl.DurationDays,
		TotalPrice: sl.TotalPrice,
		CreatedAt:  sl.CreatedAt, UpdatedAt: sl.UpdatedAt,
	}
	if sl.UnitPricePerPing.Valid {
		resp.UnitPricePerPing = &sl.UnitPricePerPing.Float64
	}
	if sl.ParkingType.Valid {
		resp.ParkingType = &sl.ParkingType.String
	}
	if sl.ParkingPrice.Valid {
		resp.ParkingPrice = &sl.ParkingPrice.Float64
	}
	if sl.Notes.Valid {
		resp.Notes = &sl.Notes.String
	}
	if sl.PublishedAt.Valid {
		resp.PublishedAt = &sl.PublishedAt.Time
	}
	if sl.ExpiresAt.Valid {
		resp.ExpiresAt = &sl.ExpiresAt.Time
	}
	if sl.Property != nil {
		p := sl.Property
		pResp := PropertySummaryResponse{
			ID: p.ID, Title: p.Title, Address: p.Address,
			BuildingType: p.BuildingType, IsCornerUnit: p.IsCornerUnit,
			ParkingType: p.ParkingType, SecurityType: p.SecurityType,
		}
		if p.Floor.Valid {
			v := p.Floor.Int32
			pResp.Floor = &v
		}
		if p.TotalFloors.Valid {
			v := p.TotalFloors.Int32
			pResp.TotalFloors = &v
		}
		if p.MainArea.Valid {
			v := p.MainArea.Float64
			pResp.MainArea = &v
		}
		if p.AuxiliaryArea.Valid {
			v := p.AuxiliaryArea.Float64
			pResp.AuxiliaryArea = &v
		}
		if p.BalconyArea.Valid {
			v := p.BalconyArea.Float64
			pResp.BalconyArea = &v
		}
		if p.Rooms.Valid {
			v := p.Rooms.Int32
			pResp.Rooms = &v
		}
		if p.LivingRooms.Valid {
			v := p.LivingRooms.Int32
			pResp.LivingRooms = &v
		}
		if p.Bathrooms.Valid {
			v := p.Bathrooms.Int32
			pResp.Bathrooms = &v
		}
		if p.BuildingAge.Valid {
			v := p.BuildingAge.Int32
			pResp.BuildingAge = &v
		}
		if p.ManagementFee.Valid {
			v := p.ManagementFee.Float64
			pResp.ManagementFee = &v
		}
		if p.BuildingOrientation.Valid {
			pResp.BuildingOrientation = &p.BuildingOrientation.String
		}
		if p.WindowOrientation.Valid {
			pResp.WindowOrientation = &p.WindowOrientation.String
		}
		resp.Property = &pResp
	}
	return resp
}

func (h *Handler) GetForProperty(c *gin.Context) {
	propID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	sl, err := h.svc.GetActiveByProperty(propID, walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	if sl == nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toResponse(sl)})
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
