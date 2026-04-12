package dto

type CreateTaskRequest struct {
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	Status       string  `json:"status"`
	Priority     string  `json:"priority"`
	RewardAmount string  `json:"rewardAmount"`
	DueDate      *string `json:"dueDate"`
}

type UpdateTaskRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    string  `json:"priority"`
	DueDate     *string `json:"dueDate"`
	Status      string  `json:"status"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}

type SubmitTaskRequest struct {
	ResultContent string `json:"resultContent"`
	ResultFileUrl string `json:"resultFileUrl"`
	ResultHash    string `json:"resultHash"`
}

type TaskResponse struct {
	ID                    int64   `json:"id"`
	TaskID                string  `json:"taskId"`
	WalletAddress         string  `json:"walletAddress"`
	AssigneeWalletAddress *string `json:"assigneeWalletAddress,omitempty"`
	Title                 string  `json:"title"`
	Description           string  `json:"description"`
	Status                string  `json:"status"`
	Priority              string  `json:"priority"`
	RewardAmount          string  `json:"rewardAmount"`
	FeeBps                int     `json:"feeBps"`
	OnchainStatus         string  `json:"onchainStatus"`
	FundTxHash            *string `json:"fundTxHash,omitempty"`
	ApproveTxHash         *string `json:"approveTxHash,omitempty"`
	ClaimTxHash           *string `json:"claimTxHash,omitempty"`
	CancelTxHash          *string `json:"cancelTxHash,omitempty"`
	DueDate               *string `json:"dueDate"`
	CreatedAt             string  `json:"createdAt"`
	UpdatedAt             string  `json:"updatedAt"`
	IsOwner               bool    `json:"isOwner"`
	IsAssignee            bool    `json:"isAssignee"`
	CanAccept             bool    `json:"canAccept"`
	CanEdit               bool    `json:"canEdit"`
	CanCancel             bool    `json:"canCancel"`
	CanSubmit             bool    `json:"canSubmit"`
	CanApprove            bool    `json:"canApprove"`
	CanClaim              bool    `json:"canClaim"`
	CanClaimOnchain       bool    `json:"canClaimOnchain"`
	CanFund               bool    `json:"canFund"`
}

type TaskListResponse struct {
	Success bool           `json:"success"`
	Data    []TaskResponse `json:"data"`
	Message string         `json:"message"`
}

type TaskDetailResponse struct {
	Success bool         `json:"success"`
	Data    TaskResponse `json:"data"`
	Message string       `json:"message"`
}

type SuccessResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type ErrorResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}
