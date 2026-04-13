package task

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	platformauth "go-service/internal/platform/auth"

	"go-service/internal/db/model"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	taskService       *TaskService
	taskPermissionSvc *TaskPermissionService
}

type UpdateOnchainTxRequest struct {
	TxHash string `json:"txHash"`
}

func NewTaskHandler(
	taskService *TaskService,
	taskPermissionSvc *TaskPermissionService,
) *TaskHandler {
	return &TaskHandler{
		taskService:       taskService,
		taskPermissionSvc: taskPermissionSvc,
	}
}

func getWalletAddressFromContext(c *gin.Context) string {
	walletAddressValue, exists := c.Get(platformauth.ContextWalletAddress)
	if !exists {
		return ""
	}

	walletAddress, ok := walletAddressValue.(string)
	if !ok {
		return ""
	}

	return walletAddress
}

func (h *TaskHandler) GetTasks(c *gin.Context) {
	walletAddress := getWalletAddressFromContext(c)

	tasks, err := h.taskService.GetTasks()
	if err != nil {
		log.Printf("[GetTasks] error: %v", err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to get tasks",
		})
		return
	}

	response := make([]TaskResponse, 0, len(tasks))
	for _, task := range tasks {
		response = append(response, h.toTaskResponse(task, walletAddress))
	}

	c.JSON(http.StatusOK, TaskListResponse{
		Success: true,
		Data:    response,
		Message: "",
	})
}

func (h *TaskHandler) GetTask(c *gin.Context) {
	walletAddress := getWalletAddressFromContext(c)

	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	task, err := h.taskService.GetTaskByID(id)
	if err != nil {
		log.Printf("[GetTask] id=%d error: %v", id, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to get task",
		})
		return
	}

	c.JSON(http.StatusOK, TaskDetailResponse{
		Success: true,
		Data:    h.toTaskResponse(*task, walletAddress),
		Message: "",
	})
}

func (h *TaskHandler) toTaskResponse(task model.Task, walletAddress string) TaskResponse {
	var dueDate *string
	if task.DueDate != nil {
		formatted := task.DueDate.Format(time.RFC3339)
		dueDate = &formatted
	}

	return TaskResponse{
		ID:                    task.ID,
		TaskID:                task.TaskID,
		WalletAddress:         task.WalletAddress,
		AssigneeWalletAddress: task.AssigneeWalletAddress,
		Title:                 task.Title,
		Description:           task.Description,
		Status:                task.Status,
		Priority:              task.Priority,
		RewardAmount:          task.RewardAmount,
		FeeBps:                task.FeeBps,
		PaymentAssetType:      "NATIVE",
		OnchainStatus:         task.OnchainStatus,
		FundTxHash:            task.FundTxHash,
		ApproveTxHash:         task.ApproveTxHash,
		ClaimTxHash:           task.ClaimTxHash,
		CancelTxHash:          task.CancelTxHash,
		DueDate:               dueDate,
		CreatedAt:             task.CreatedAt.Format(time.RFC3339),
		UpdatedAt:             task.UpdatedAt.Format(time.RFC3339),
		IsOwner:               h.taskPermissionSvc.IsTaskOwner(task, walletAddress),
		IsAssignee:            h.taskPermissionSvc.IsTaskAssignee(task, walletAddress),
		CanAccept:             h.taskPermissionSvc.CanAcceptTask(task, walletAddress),
		CanEdit:               h.taskPermissionSvc.CanEditTask(task, walletAddress),
		CanCancel:             h.taskPermissionSvc.CanCancelTask(task, walletAddress),
		CanSubmit:             h.taskPermissionSvc.CanSubmitTask(task, walletAddress),
		CanApprove:            h.taskPermissionSvc.CanApproveTask(task, walletAddress),
		CanClaim:              h.taskPermissionSvc.CanClaimReward(task, walletAddress),
		CanClaimOnchain:       h.taskPermissionSvc.CanClaimOnchain(task, walletAddress),
		CanFund:               h.taskPermissionSvc.CanFundTask(task, walletAddress),
	}
}

func (h *TaskHandler) CreateTask(c *gin.Context) {
	var req CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid request body",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	id, err := h.taskService.CreateTask(walletAddress, req)
	if err != nil {
		log.Printf("[CreateTask] wallet=%s error: %v", walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to create task",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "task created successfully",
		"data": gin.H{
			"id": id,
		},
	})
}

func (h *TaskHandler) UpdateTask(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	var req UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid request body",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.UpdateTask(id, walletAddress, req)
	if err != nil {
		if errors.Is(err, errors.New("forbidden")) || err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to update task",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task updated successfully",
	})
}

func (h *TaskHandler) UpdateTaskStatus(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	var req UpdateTaskStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid request body",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.UpdateTaskStatus(id, walletAddress, req.Status)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to update task status",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task status updated successfully",
	})
}

func (h *TaskHandler) AcceptTask(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.AcceptTask(id, walletAddress)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		log.Printf("[AcceptTask] id=%d wallet=%s error: %v", id, walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to accept task",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task accepted successfully",
	})
}

func (h *TaskHandler) CancelTask(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.CancelTask(id, walletAddress)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		log.Printf("[CancelTask] id=%d wallet=%s error: %v", id, walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to cancel task",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task cancelled successfully",
	})
}

func (h *TaskHandler) SubmitTask(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	var req SubmitTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid request body",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.SubmitTask(id, walletAddress, req.ResultContent, req.ResultFileUrl, req.ResultHash)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		log.Printf("[SubmitTask] id=%d wallet=%s error: %v", id, walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to submit task",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task submitted successfully",
	})
}

func (h *TaskHandler) ApproveTask(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.ApproveTask(id, walletAddress)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		log.Printf("[ApproveTask] id=%d wallet=%s error: %v", id, walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "task approved successfully",
	})
}

func (h *TaskHandler) ClaimReward(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Message: "invalid task id",
		})
		return
	}

	walletAddress := getWalletAddressFromContext(c)
	if walletAddress == "" {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Success: false,
			Message: "wallet address not found in session",
		})
		return
	}

	err = h.taskService.ClaimReward(id, walletAddress)
	if err != nil {
		if err.Error() == "forbidden" {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Success: false,
				Message: "forbidden",
			})
			return
		}

		log.Printf("[ClaimReward] id=%d wallet=%s error: %v", id, walletAddress, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Success: false,
			Message: "failed to claim reward",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "reward claimed successfully",
	})
}

func (h *TaskHandler) MarkTaskFunded(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Success: false, Message: "invalid task id"})
		return
	}

	var req UpdateOnchainTxRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TxHash == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}

	if err := h.taskService.MarkTaskFunded(id, req.TxHash); err != nil {
		log.Printf("[MarkTaskFunded] id=%d txHash=%s error: %v", id, req.TxHash, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{Success: false, Message: "failed to mark task funded"})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Success: true, Message: "task funded marked successfully"})
}

func (h *TaskHandler) MarkTaskClaimedOnchain(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Success: false, Message: "invalid task id"})
		return
	}

	var req UpdateOnchainTxRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.TxHash == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Success: false, Message: "invalid request body"})
		return
	}

	if err := h.taskService.MarkTaskClaimedOnchain(id, req.TxHash); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Success: false, Message: "failed to mark task claimed"})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{Success: true, Message: "task claimed marked successfully"})
}

func (h *TaskHandler) FundTask(c *gin.Context) {
	idParam := c.Param("id")
	id, _ := strconv.ParseInt(idParam, 10, 64)

	var req struct {
		TxHash string `json:"txHash"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	err := h.taskService.MarkTaskFunded(id, req.TxHash)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"message": "funded"})
}
