package property

import (
	"context"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type APIService interface {
	Create(wallet, title, address string) (int64, error)
	ListMine(wallet string) ([]*model.Property, error)
	GetForOwner(id int64, wallet string) (*model.Property, error)
	Update(id int64, wallet string, req UpdatePropertyRequest) error
	AddAttachment(propertyID int64, wallet, attachType, url string) (int64, error)
	DeleteAttachment(propertyID, attachmentID int64, wallet string) error
	UploadPhoto(ctx context.Context, propertyID int64, wallet string, data []byte, contentType string) (int64, string, error)
	DownloadPhoto(ctx context.Context, propertyID int64, filename string) ([]byte, string, error)
	RemoveProperty(ctx context.Context, propertyID int64, wallet string) error
}

type Handler struct {
	svc APIService
}

func NewHandler(svc APIService) *Handler {
	return &Handler{svc: svc}
}

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func (h *Handler) Create(c *gin.Context) {
	var req CreatePropertyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.Create(walletFrom(c), req.Title, req.Address)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

func (h *Handler) ListMine(c *gin.Context) {
	props, err := h.svc.ListMine(walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	resp := make([]PropertyResponse, 0, len(props))
	for _, p := range props {
		resp = append(resp, toPropertyResponse(p))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) Get(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	p, err := h.svc.GetForOwner(id, walletFrom(c))
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toPropertyResponse(p)})
}

func (h *Handler) Update(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req UpdatePropertyRequest
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

func (h *Handler) AddAttachment(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req struct {
		Type string `json:"type" binding:"required,oneof=PHOTO DEED FLOOR_PLAN DISCLOSURE"`
		URL  string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	attachID, err := h.svc.AddAttachment(id, walletFrom(c), req.Type, req.URL)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": attachID}})
}

func (h *Handler) DeleteAttachment(c *gin.Context) {
	propID, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	attachID, err := strconv.ParseInt(c.Param("aid"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid attachment id"})
		return
	}
	if err := h.svc.DeleteAttachment(propID, attachID, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "deleted"})
}

func (h *Handler) RemoveProperty(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid property id"})
		return
	}
	if err := h.svc.RemoveProperty(c.Request.Context(), id, walletFrom(c)); err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func toPropertyResponse(p *model.Property) PropertyResponse {
	resp := PropertyResponse{
		ID:           p.ID,
		OwnerUserID:  p.OwnerUserID,
		Title:        p.Title,
		Address:      p.Address,
		BuildingType: p.BuildingType,
		IsCornerUnit: p.IsCornerUnit,
		HasDarkRoom:  p.HasDarkRoom,
		ParkingType:  p.ParkingType,
		SecurityType: p.SecurityType,
		SetupStatus:  p.SetupStatus,
		CreatedAt:    p.CreatedAt,
		UpdatedAt:    p.UpdatedAt,
	}
	if p.DistrictID.Valid {
		v := p.DistrictID.Int64
		resp.DistrictID = &v
	}
	if p.Floor.Valid {
		v := p.Floor.Int32
		resp.Floor = &v
	}
	if p.TotalFloors.Valid {
		v := p.TotalFloors.Int32
		resp.TotalFloors = &v
	}
	if p.MainArea.Valid {
		v := p.MainArea.Float64
		resp.MainArea = &v
	}
	if p.AuxiliaryArea.Valid {
		v := p.AuxiliaryArea.Float64
		resp.AuxiliaryArea = &v
	}
	if p.BalconyArea.Valid {
		v := p.BalconyArea.Float64
		resp.BalconyArea = &v
	}
	if p.SharedArea.Valid {
		v := p.SharedArea.Float64
		resp.SharedArea = &v
	}
	if p.AwningArea.Valid {
		v := p.AwningArea.Float64
		resp.AwningArea = &v
	}
	if p.LandArea.Valid {
		v := p.LandArea.Float64
		resp.LandArea = &v
	}
	if p.Rooms.Valid {
		v := p.Rooms.Int32
		resp.Rooms = &v
	}
	if p.LivingRooms.Valid {
		v := p.LivingRooms.Int32
		resp.LivingRooms = &v
	}
	if p.Bathrooms.Valid {
		v := p.Bathrooms.Int32
		resp.Bathrooms = &v
	}
	if p.BuildingAge.Valid {
		v := p.BuildingAge.Int32
		resp.BuildingAge = &v
	}
	if p.BuildingStructure.Valid {
		resp.BuildingStructure = &p.BuildingStructure.String
	}
	if p.ExteriorMaterial.Valid {
		resp.ExteriorMaterial = &p.ExteriorMaterial.String
	}
	if p.BuildingUsage.Valid {
		resp.BuildingUsage = &p.BuildingUsage.String
	}
	if p.Zoning.Valid {
		resp.Zoning = &p.Zoning.String
	}
	if p.UnitsOnFloor.Valid {
		v := p.UnitsOnFloor.Int32
		resp.UnitsOnFloor = &v
	}
	if p.BuildingOrientation.Valid {
		resp.BuildingOrientation = &p.BuildingOrientation.String
	}
	if p.WindowOrientation.Valid {
		resp.WindowOrientation = &p.WindowOrientation.String
	}
	if p.ManagementFee.Valid {
		resp.ManagementFee = &p.ManagementFee.Float64
	}
	resp.Attachments = make([]AttachmentResponse, 0, len(p.Attachments))
	for _, a := range p.Attachments {
		resp.Attachments = append(resp.Attachments, AttachmentResponse{
			ID: a.ID, Type: a.Type, URL: a.URL, CreatedAt: a.CreatedAt,
		})
	}
	return resp
}

func handleErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrNotOwner):
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrPropertyListed):
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrInvalidStatus):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
	}
}

func parseID(c *gin.Context) (int64, error) {
	return strconv.ParseInt(c.Param("id"), 10, 64)
}

func (h *Handler) UploadPhoto(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	file, header, err := c.Request.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "photo field required"})
		return
	}
	defer file.Close()
	const maxSize = 10 << 20 // 10 MB
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "file too large (max 10 MB)"})
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "read failed"})
		return
	}
	ct := header.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	attachID, proxyURL, err := h.svc.UploadPhoto(c.Request.Context(), id, walletFrom(c), data, ct)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": attachID, "url": proxyURL}})
}

func (h *Handler) ServePhoto(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	filename := filepath.Base(c.Param("filename"))
	data, ct, err := h.svc.DownloadPhoto(c.Request.Context(), id, filename)
	if err != nil {
		handleErr(c, err)
		return
	}
	c.Data(http.StatusOK, ct, data)
}
