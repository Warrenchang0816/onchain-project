package task

import (
	"strings"

	"go-service/internal/db/model"
)

type TaskPermissionService struct {
	GodModeWalletAddress string
}

func NewTaskPermissionService(godModeWalletAddress string) *TaskPermissionService {
	return &TaskPermissionService{
		GodModeWalletAddress: godModeWalletAddress,
	}
}

func normalizeWalletAddress(address string) string {
	return strings.ToLower(strings.TrimSpace(address))
}

func (s *TaskPermissionService) IsGod(walletAddress string) bool {
	return normalizeWalletAddress(walletAddress) != "" &&
		normalizeWalletAddress(walletAddress) == normalizeWalletAddress(s.GodModeWalletAddress)
}

func (s *TaskPermissionService) IsTaskOwner(task model.Task, walletAddress string) bool {
	return normalizeWalletAddress(task.WalletAddress) == normalizeWalletAddress(walletAddress)
}

func (s *TaskPermissionService) IsTaskAssignee(task model.Task, walletAddress string) bool {
	if task.AssigneeWalletAddress == nil {
		return false
	}

	return normalizeWalletAddress(*task.AssigneeWalletAddress) == normalizeWalletAddress(walletAddress)
}

func (s *TaskPermissionService) CanEditTask(task model.Task, walletAddress string) bool {
	if task.Status == string(model.TaskStatusSubmitted) ||
		task.Status == string(model.TaskStatusApproved) ||
		task.Status == string(model.TaskStatusCompleted) ||
		task.Status == string(model.TaskStatusCancelled) {
		return false
	}

	// Once funds are locked on-chain, the task details cannot be changed.
	if task.OnchainStatus != string(model.OnchainStatusNotFunded) {
		return false
	}

	return s.IsGod(walletAddress) || s.IsTaskOwner(task, walletAddress)
}

func (s *TaskPermissionService) CanCancelTask(task model.Task, walletAddress string) bool {
	if task.Status == string(model.TaskStatusCompleted) ||
		task.Status == string(model.TaskStatusCancelled) ||
		task.Status == string(model.TaskStatusApproved) {
		return false
	}

	if task.Status == string(model.TaskStatusInProgress) ||
		task.Status == string(model.TaskStatusSubmitted) {
		return false
	}

	// Once funds are locked on-chain, cancel requires an on-chain refund flow
	// which is not yet implemented.
	if task.OnchainStatus != string(model.OnchainStatusNotFunded) {
		return false
	}

	return s.IsGod(walletAddress) || s.IsTaskOwner(task, walletAddress)
}

func (s *TaskPermissionService) CanAcceptTask(task model.Task, walletAddress string) bool {
	if task.Status != string(model.TaskStatusOpen) {
		return false
	}

	if task.AssigneeWalletAddress != nil {
		return false
	}

	if s.IsTaskOwner(task, walletAddress) {
		return false
	}

	return s.IsGod(walletAddress) || normalizeWalletAddress(walletAddress) != ""
}

func (s *TaskPermissionService) CanSubmitTask(task model.Task, walletAddress string) bool {
	if task.Status != string(model.TaskStatusInProgress) {
		return false
	}

	return s.IsGod(walletAddress) || s.IsTaskAssignee(task, walletAddress)
}

func (s *TaskPermissionService) CanApproveTask(task model.Task, walletAddress string) bool {
	if task.Status != string(model.TaskStatusSubmitted) {
		return false
	}

	// Tasks with a reward must have been funded and accepted before approval.
	// On-chain assignment may have been deferred to approve time (FUNDED state),
	// so allow FUNDED (with an assignee) as well as ASSIGNED.
	if task.RewardAmount != "" && task.RewardAmount != "0" {
		switch task.OnchainStatus {
		case string(model.OnchainStatusAssigned):
			// normal path
		case string(model.OnchainStatusFunded):
			// deferred-assignment path: assignWorker + approveTask will run together
			if task.AssigneeWalletAddress == nil || *task.AssigneeWalletAddress == "" {
				return false
			}
		default:
			return false
		}
	}

	return s.IsGod(walletAddress) || s.IsTaskOwner(task, walletAddress)
}

func (s *TaskPermissionService) CanFundTask(task model.Task, walletAddress string) bool {
	if task.RewardAmount == "" || task.RewardAmount == "0" {
		return false
	}
	if task.OnchainStatus != string(model.OnchainStatusNotFunded) {
		return false
	}
	if task.Status == string(model.TaskStatusSubmitted) ||
		task.Status == string(model.TaskStatusApproved) ||
		task.Status == string(model.TaskStatusCompleted) ||
		task.Status == string(model.TaskStatusCancelled) {
		return false
	}
	return s.IsGod(walletAddress) || s.IsTaskOwner(task, walletAddress)
}

func (s *TaskPermissionService) CanClaimReward(task model.Task, walletAddress string) bool {
	if task.Status != string(model.TaskStatusApproved) {
		return false
	}

	// Tasks with reward must be claimed on-chain via ClaimOnchainButton
	if task.RewardAmount != "" && task.RewardAmount != "0" {
		return false
	}

	return s.IsGod(walletAddress) || s.IsTaskAssignee(task, walletAddress)
}

func (s *TaskPermissionService) CanClaimOnchain(task model.Task, walletAddress string) bool {
	if task.Status != string(model.TaskStatusApproved) {
		return false
	}

	if task.RewardAmount == "" || task.RewardAmount == "0" {
		return false
	}

	if task.OnchainStatus != string(model.OnchainStatusApproved) {
		return false
	}

	return s.IsGod(walletAddress) || s.IsTaskAssignee(task, walletAddress)
}
