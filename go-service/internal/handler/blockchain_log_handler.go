package handler

import (
	"go-service/internal/repository"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type BlockchainLogHandler struct {
	repo *repository.BlockchainLogRepository
}

func NewBlockchainLogHandler(repo *repository.BlockchainLogRepository) *BlockchainLogHandler {
	return &BlockchainLogHandler{repo: repo}
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

func (h *BlockchainLogHandler) GetLogs(c *gin.Context) {
	logs, err := h.repo.FindAll()
	if err != nil {
		log.Printf("[GetLogs] error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to get logs"})
		return
	}

	response := make([]BlockchainLogResponse, 0, len(logs))
	for _, l := range logs {
		response = append(response, BlockchainLogResponse{
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

	c.JSON(http.StatusOK, gin.H{"success": true, "data": response})
}
