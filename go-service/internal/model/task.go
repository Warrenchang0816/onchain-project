package model

import "time"

type TaskStatus string
type TaskOnchainStatus string

const (
	TaskStatusOpen       TaskStatus = "OPEN"
	TaskStatusInProgress TaskStatus = "IN_PROGRESS"
	TaskStatusSubmitted  TaskStatus = "SUBMITTED"
	TaskStatusApproved   TaskStatus = "APPROVED"
	TaskStatusCancelled  TaskStatus = "CANCELLED"
	TaskStatusCompleted  TaskStatus = "COMPLETED"
)

const (
	OnchainStatusNotFunded TaskOnchainStatus = "NOT_FUNDED"
	OnchainStatusFunded    TaskOnchainStatus = "FUNDED"
	OnchainStatusAssigned  TaskOnchainStatus = "ASSIGNED"
	OnchainStatusApproved  TaskOnchainStatus = "APPROVED"
	OnchainStatusClaimed   TaskOnchainStatus = "CLAIMED"
	OnchainStatusRefunded  TaskOnchainStatus = "REFUNDED"
	OnchainStatusCancelled TaskOnchainStatus = "CANCELLED"
)

type Task struct {
	ID                    int64
	TaskID                string
	WalletAddress         string
	AssigneeWalletAddress *string
	Title                 string
	Description           string
	Status                string
	Priority              string
	RewardAmount          string
	FeeBps                int

	ChainID              *int64
	VaultContractAddress *string
	ContractTaskID       *string

	OnchainStatus string
	FundTxHash    *string
	ApproveTxHash *string
	ClaimTxHash   *string
	CancelTxHash  *string

	DueDate   *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}
