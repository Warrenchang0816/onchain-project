package agent

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Handler serves the public agent directory endpoints.
type Handler struct {
	svc *Service
}

// NewHandler constructs an agent Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// ListAgents handles GET /api/agents.
func (h *Handler) ListAgents(c *gin.Context) {
	resp, err := h.svc.ListAgents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GetAgentByWallet handles GET /api/agents/:wallet.
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
