package listing

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// getWallet extracts the authenticated wallet address from gin context.
func getWallet(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func toListingResponse(l *model.Listing, appts []*model.ListingAppointment, callerWallet string, ownerWallet string) ListingResponse {
	resp := ListingResponse{
		ID:                l.ID,
		OwnerUserID:       l.OwnerUserID,
		Title:             l.Title,
		Address:           l.Address,
		ListType:          l.ListType,
		Price:             l.Price,
		IsPetAllowed:      l.IsPetAllowed,
		IsParkingIncluded: l.IsParkingIncluded,
		Status:            l.Status,
		DailyFeeNTD:       l.DailyFeeNTD,
		CreatedAt:         l.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:         l.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		IsOwner:           callerWallet != "" && callerWallet == ownerWallet,
	}

	if l.Description.Valid {
		resp.Description = &l.Description.String
	}
	if l.District.Valid {
		resp.District = &l.District.String
	}
	if l.AreaPing.Valid {
		v := l.AreaPing.Float64
		resp.AreaPing = &v
	}
	if l.Floor.Valid {
		v := l.Floor.Int64
		resp.Floor = &v
	}
	if l.TotalFloors.Valid {
		v := l.TotalFloors.Int64
		resp.TotalFloors = &v
	}
	if l.RoomCount.Valid {
		v := l.RoomCount.Int64
		resp.RoomCount = &v
	}
	if l.BathroomCount.Valid {
		v := l.BathroomCount.Int64
		resp.BathroomCount = &v
	}
	if l.PublishedAt.Valid {
		s := l.PublishedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		resp.PublishedAt = &s
	}
	if l.ExpiresAt.Valid {
		s := l.ExpiresAt.Time.Format("2006-01-02T15:04:05Z07:00")
		resp.ExpiresAt = &s
	}

	if appts != nil {
		list := make([]AppointmentResponse, 0, len(appts))
		for _, a := range appts {
			ar := toApptResponse(a)
			list = append(list, ar)
			if l.NegotiatingAppointmentID.Valid && l.NegotiatingAppointmentID.Int64 == a.ID {
				copyAr := ar
				resp.NegotiatingAppointment = &copyAr
			}
		}
		resp.Appointments = list
	}

	return resp
}

func toApptResponse(a *model.ListingAppointment) AppointmentResponse {
	ar := AppointmentResponse{
		ID:            a.ID,
		ListingID:     a.ListingID,
		VisitorUserID: a.VisitorUserID,
		QueuePosition: a.QueuePosition,
		PreferredTime: a.PreferredTime.Format("2006-01-02T15:04:05Z07:00"),
		Status:        a.Status,
		CreatedAt:     a.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if a.ConfirmedTime.Valid {
		s := a.ConfirmedTime.Time.Format("2006-01-02T15:04:05Z07:00")
		ar.ConfirmedTime = &s
	}
	if a.Note.Valid {
		ar.Note = &a.Note.String
	}
	return ar
}

func handleSvcError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrNotKYCVerified):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrInvalidStatus):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, ErrAlreadyBooked):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

// GET /api/listings  (optional auth — caller wallet used for isOwner flag)
func (h *Handler) ListListings(c *gin.Context) {
	listType := c.Query("type")
	district := c.Query("district")

	listings, err := h.svc.ListPublic(listType, district)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	caller := getWallet(c)
	resp := make([]ListingResponse, 0, len(listings))
	for _, l := range listings {
		resp = append(resp, toListingResponse(l, nil, caller, ""))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GET /api/listings/mine  (auth required)
func (h *Handler) ListMyListings(c *gin.Context) {
	wallet := getWallet(c)
	listings, err := h.svc.ListByOwner(wallet)
	if err != nil {
		handleSvcError(c, err)
		return
	}
	resp := make([]ListingResponse, 0, len(listings))
	for _, l := range listings {
		resp = append(resp, toListingResponse(l, nil, wallet, wallet))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GET /api/listings/:id  (optional auth)
func (h *Handler) GetListing(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	l, appts, err := h.svc.GetDetail(id)
	if err != nil {
		handleSvcError(c, err)
		return
	}

	// Resolve owner wallet for isOwner flag (best-effort; empty if not found).
	caller := getWallet(c)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": toListingResponse(l, appts, caller, "")})
}

// POST /api/listings  (auth required, KYC VERIFIED)
func (h *Handler) CreateListing(c *gin.Context) {
	var req CreateListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	id, err := h.svc.Create(getWallet(c), req)
	if err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// PUT /api/listings/:id  (auth required, owner only)
func (h *Handler) UpdateListing(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req UpdateListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Update(id, getWallet(c), req); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/publish  (auth required, owner only)
func (h *Handler) PublishListing(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req PublishListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.Publish(id, getWallet(c), req.DurationDays); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/remove  (auth required, owner only)
func (h *Handler) RemoveListing(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.Remove(id, getWallet(c)); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/close  (auth required, owner only — traditional route)
func (h *Handler) CloseListing(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.Close(id, getWallet(c)); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/negotiate  (auth required, owner only)
func (h *Handler) LockNegotiation(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req LockNegotiationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.LockForNegotiation(id, getWallet(c), req.AppointmentID); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/unlock  (auth required, owner only)
func (h *Handler) UnlockNegotiation(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	if err := h.svc.UnlockNegotiation(id, getWallet(c)); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── Appointment handlers ──────────────────────────────────────────────────────

// POST /api/listings/:id/appointments  (auth required, KYC VERIFIED)
func (h *Handler) BookAppointment(c *gin.Context) {
	listingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid listing id"})
		return
	}
	var req CreateAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	apptID, err := h.svc.BookAppointment(listingID, getWallet(c), req)
	if err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": apptID}})
}

// PUT /api/listings/:id/appointments/:appt_id/confirm  (auth required, owner only)
func (h *Handler) ConfirmAppointment(c *gin.Context) {
	apptID, err := strconv.ParseInt(c.Param("appt_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	var req ConfirmAppointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.ConfirmAppointment(apptID, getWallet(c), req); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/appointments/:appt_id/status  (auth required, visitor only)
func (h *Handler) UpdateAppointmentStatus(c *gin.Context) {
	apptID, err := strconv.ParseInt(c.Param("appt_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	var req UpdateAppointmentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.svc.UpdateAppointmentStatus(apptID, getWallet(c), req); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /api/listings/:id/appointments/:appt_id/cancel  (auth required, owner only)
func (h *Handler) CancelAppointment(c *gin.Context) {
	apptID, err := strconv.ParseInt(c.Param("appt_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appointment id"})
		return
	}
	if err := h.svc.CancelAppointmentByOwner(apptID, getWallet(c)); err != nil {
		handleSvcError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
