package task

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
	"go-service/internal/platform/config"
)

type TaskService struct {
	taskRepo           *repository.TaskRepository
	logRepo            *repository.BlockchainLogRepository
	taskPermissionSvc  *TaskPermissionService
	platformFeeBps     int
	taskRewardVaultSvc TaskRewardVaultService
	blockchainConfig   *config.BlockchainConfig
}

func NewTaskService(
	taskRepo *repository.TaskRepository,
	logRepo *repository.BlockchainLogRepository,
	taskPermissionSvc *TaskPermissionService,
	platformFeeBps int,
	taskRewardVaultSvc TaskRewardVaultService,
	blockchainConfig *config.BlockchainConfig,
) *TaskService {
	return &TaskService{
		taskRepo:           taskRepo,
		logRepo:            logRepo,
		taskPermissionSvc:  taskPermissionSvc,
		platformFeeBps:     platformFeeBps,
		taskRewardVaultSvc: taskRewardVaultSvc,
		blockchainConfig:   blockchainConfig,
	}
}

func (s *TaskService) writeLog(taskID, action, txHash, status string) {
	_ = s.logRepo.Create(model.BlockchainLog{
		TaskID:          taskID,
		Action:          action,
		TxHash:          txHash,
		ChainID:         s.blockchainConfig.ChainID,
		ContractAddress: s.blockchainConfig.RewardVaultAddress,
		Status:          status,
	})
}

func (s *TaskService) GetTasks() ([]model.Task, error) {
	return s.taskRepo.FindAll()
}

func (s *TaskService) GetTaskByID(id int64) (*model.Task, error) {
	return s.taskRepo.FindByID(id)
}

func generateTaskID() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	return fmt.Sprintf("TASK-%d-%s", time.Now().Unix(), hex.EncodeToString(b)), nil
}

func (s *TaskService) CreateTask(walletAddress string, req CreateTaskRequest) (int64, error) {
	taskID, err := generateTaskID()
	if err != nil {
		return 0, err
	}

	status := req.Status
	if status == "" {
		status = string(model.TaskStatusOpen)
	}

	rewardAmount := req.RewardAmount
	if rewardAmount == "" {
		rewardAmount = "0"
	}

	chainID := s.blockchainConfig.ChainID
	vaultAddress := s.blockchainConfig.RewardVaultAddress
	contractTaskID := taskID

	task := model.Task{
		TaskID:               taskID,
		WalletAddress:        walletAddress,
		Title:                req.Title,
		Description:          req.Description,
		Status:               status,
		Priority:             req.Priority,
		RewardAmount:         rewardAmount,
		FeeBps:               s.platformFeeBps,
		ChainID:              &chainID,
		VaultContractAddress: &vaultAddress,
		ContractTaskID:       &contractTaskID,
		OnchainStatus:        string(model.OnchainStatusNotFunded),
	}

	if req.DueDate != nil && *req.DueDate != "" {
		parsed, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			return 0, err
		}
		task.DueDate = &parsed
	}

	return s.taskRepo.Create(task)
}

func (s *TaskService) UpdateTask(id int64, walletAddress string, req UpdateTaskRequest) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanEditTask(*task, walletAddress) {
		return errors.New("forbidden")
	}

	task.Title = req.Title
	task.Description = req.Description
	task.Priority = req.Priority

	if req.DueDate != nil && *req.DueDate != "" {
		parsed, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			return err
		}
		task.DueDate = &parsed
	} else {
		task.DueDate = nil
	}

	return s.taskRepo.Update(*task)
}

func (s *TaskService) CancelTask(id int64, walletAddress string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanCancelTask(*task, walletAddress) {
		return errors.New("forbidden")
	}

	return s.taskRepo.UpdateStatus(id, string(model.TaskStatusCancelled))
}

func (s *TaskService) AcceptTask(id int64, walletAddress string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanAcceptTask(*task, walletAddress) {
		return errors.New("forbidden")
	}

	// Only update DB here. On-chain assignWorker is deferred to ApproveTask so
	// that Accept never fails due to operator key / RPC issues.
	return s.taskRepo.UpdateTaskAssignee(id, walletAddress, string(model.TaskStatusInProgress))
}

func (s *TaskService) SubmitTask(id int64, walletAddress string, resultContent, resultFileURL, resultHash string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanSubmitTask(*task, walletAddress) {
		return errors.New("forbidden")
	}

	if err := s.taskRepo.CreateSubmission(task.ID, resultContent, resultFileURL, resultHash); err != nil {
		return err
	}

	return s.taskRepo.UpdateStatus(id, string(model.TaskStatusSubmitted))
}

func (s *TaskService) ApproveTask(id int64, walletAddress string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanApproveTask(*task, walletAddress) {
		return errors.New("forbidden")
	}

	// Off-chain task (no reward): just update status.
	if task.RewardAmount == "" || task.RewardAmount == "0" {
		return s.taskRepo.UpdateStatus(id, string(model.TaskStatusApproved))
	}

	currentOnchainStatus := task.OnchainStatus

	// If task was accepted but on-chain assignment was deferred (still FUNDED),
	// call assignWorker now before proceeding to approve.
	if currentOnchainStatus == string(model.OnchainStatusFunded) {
		if task.AssigneeWalletAddress == nil || *task.AssigneeWalletAddress == "" {
			return errors.New("task has no assignee")
		}

		assignTxHash, err := s.taskRewardVaultSvc.AssignWorker(
			context.Background(), task.TaskID, *task.AssigneeWalletAddress,
		)
		if err != nil {
			return fmt.Errorf("on-chain assign failed: %w", err)
		}

		if err := s.taskRepo.UpdateAssignInfo(id, string(model.OnchainStatusAssigned)); err != nil {
			return err
		}

		s.writeLog(task.TaskID, "ASSIGN_WORKER", assignTxHash, "SUCCESS")
		currentOnchainStatus = string(model.OnchainStatusAssigned)
	}

	if currentOnchainStatus != string(model.OnchainStatusAssigned) {
		return errors.New("task not yet assigned on-chain")
	}

	txHash, err := s.taskRewardVaultSvc.ApproveTask(context.Background(), task.TaskID)
	if err != nil {
		return err
	}

	if err := s.taskRepo.UpdateApproveInfo(
		id,
		string(model.TaskStatusApproved),
		string(model.OnchainStatusApproved),
		txHash,
	); err != nil {
		return err
	}

	s.writeLog(task.TaskID, "APPROVE_TASK", txHash, "SUCCESS")
	return nil
}

func (s *TaskService) UpdateTaskStatus(id int64, walletAddress string, status string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if s.taskPermissionSvc.IsGod(walletAddress) {
		return s.taskRepo.UpdateStatus(id, status)
	}

	if s.taskPermissionSvc.IsTaskOwner(*task, walletAddress) {
		if status == string(model.TaskStatusCancelled) {
			return s.CancelTask(id, walletAddress)
		}
		return errors.New("forbidden")
	}

	if s.taskPermissionSvc.IsTaskAssignee(*task, walletAddress) {
		return errors.New("forbidden")
	}

	return errors.New("forbidden")
}

func (s *TaskService) ClaimReward(id int64, walletAddress string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if !s.taskPermissionSvc.CanClaimReward(*task, walletAddress) {
		return errors.New("forbidden")
	}

	return s.taskRepo.UpdateStatus(id, string(model.TaskStatusCompleted))
}

func (s *TaskService) MarkTaskFunded(id int64, txHash string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if err := s.taskRepo.UpdateFundInfo(
		id,
		s.blockchainConfig.ChainID,
		s.blockchainConfig.RewardVaultAddress,
		task.TaskID,
		string(model.OnchainStatusFunded),
		txHash,
	); err != nil {
		return err
	}

	s.writeLog(task.TaskID, "FUND", txHash, "SUCCESS")

	// If task was already accepted before funding, call assignWorker now
	if task.AssigneeWalletAddress != nil && *task.AssigneeWalletAddress != "" {
		assignTxHash, err := s.taskRewardVaultSvc.AssignWorker(context.Background(), task.TaskID, *task.AssigneeWalletAddress)
		if err != nil {
			return err
		}

		if err := s.taskRepo.UpdateAssignInfo(id, string(model.OnchainStatusAssigned)); err != nil {
			return err
		}

		s.writeLog(task.TaskID, "ASSIGN_WORKER", assignTxHash, "SUCCESS")
	}

	return nil
}

func (s *TaskService) MarkTaskClaimedOnchain(id int64, txHash string) error {
	task, err := s.taskRepo.FindByID(id)
	if err != nil {
		return err
	}

	if err := s.taskRepo.UpdateClaimInfo(
		id,
		string(model.TaskStatusCompleted),
		string(model.OnchainStatusClaimed),
		txHash,
	); err != nil {
		return err
	}

	s.writeLog(task.TaskID, "CLAIM_REWARD", txHash, "SUCCESS")
	return nil
}
