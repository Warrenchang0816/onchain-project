package agent

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListAgents(c *gin.Context) {
	filter := AgentListFilter{
		ServiceArea:     c.Query("serviceArea"),
		ProfileComplete: normalizeProfileCompleteFilter(c.Query("profile")),
	}
	resp, err := h.svc.ListAgents(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) GetAgentByWallet(c *gin.Context) {
	wallet := c.Param("wallet")
	resp, err := h.svc.GetByWallet(wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	if resp == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) GetMyProfile(c *gin.Context) {
	wallet := c.GetString("walletAddress")
	resp, err := h.svc.GetMyProfile(wallet)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

func (h *Handler) UpsertMyProfile(c *gin.Context) {
	wallet := c.GetString("walletAddress")
	var req UpsertMyAgentProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	resp, err := h.svc.UpsertMyProfile(wallet, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}
