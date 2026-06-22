package appointment

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"go-service/internal/db/model"
	platformauth "go-service/internal/platform/auth"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

func toResp(a *model.ViewingAppointment) AppointmentResponse {
	r := AppointmentResponse{
		ID: a.ID, PropertyID: a.PropertyID, VisitorUserID: a.VisitorUserID,
		QueuePosition: a.QueuePosition, PreferredTime: a.PreferredTime, Status: a.Status,
	}
	if a.ConfirmedTime.Valid {
		t := a.ConfirmedTime.Time
		r.ConfirmedTime = &t
	}
	if a.Note.Valid {
		n := a.Note.String
		r.Note = &n
	}
	return r
}

// POST /rental-listing/:id/appointments
func (h *Handler) Book(c *gin.Context) {
	rlID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	var req BookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	id, err := h.svc.BookForRentalListingByWallet(rlID, walletFrom(c), req.PreferredTime, req.Note)
	if err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{"id": id}})
}

// GET /property/:id/appointments
func (h *Handler) ListForProperty(c *gin.Context) {
	pid, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	appts, err := h.svc.ListForOwner(pid, walletFrom(c))
	if err != nil {
		writeErr(c, err)
		return
	}
	out := make([]AppointmentResponse, 0, len(appts))
	for _, a := range appts {
		out = append(out, toResp(a))
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": out})
}

// PUT /appointments/:id/confirm
func (h *Handler) Confirm(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req ConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.Confirm(id, walletFrom(c), req.ConfirmedTime); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /appointments/:id/status
func (h *Handler) SetStatus(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	var req StatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.svc.SetStatus(id, walletFrom(c), req.Status); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// PUT /appointments/:id/cancel
func (h *Handler) Cancel(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	if err := h.svc.SetStatus(id, walletFrom(c), model.AppointmentStatusCancelled); err != nil {
		writeErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func writeErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidStatus):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrForbidden):
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": err.Error()})
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrListingNotFound):
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
	}
}
