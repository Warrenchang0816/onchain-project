package logs

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/repository"
)

type Handler struct {
	repo *repository.BlockchainLogRepository
}

func NewHandler(repo *repository.BlockchainLogRepository) *Handler {
	return &Handler{repo: repo}
}

type BlockchainLogResponse struct {
	ID              int64  `json:"id"`
	TaskID          string `json:"taskId"`
	WalletAddress   string `json:"walletAddress"`
	Action          string `json:"action"`
	TxHash          string `json:"txHash"`
	ChainID         int64  `json:"chainId"`
	ContractAddress string `json:"contractAddress"`
	Status          string `json:"status"`
	CreatedAt       string `json:"createdAt"`
}

// GET /api/blockchain-logs
func (h *Handler) GetLogs(c *gin.Context) {
	entries, err := h.repo.FindAll()
	if err != nil {
		log.Printf("[GetLogs] error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to get logs"})
		return
	}

	resp := make([]BlockchainLogResponse, 0, len(entries))
	for _, l := range entries {
		resp = append(resp, BlockchainLogResponse{
			ID:              l.ID,
			TaskID:          l.TaskID,
			WalletAddress:   l.WalletAddress,
			Action:          l.Action,
			TxHash:          l.TxHash,
			ChainID:         l.ChainID,
			ContractAddress: l.ContractAddress,
			Status:          l.Status,
			CreatedAt:       l.CreatedAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}
