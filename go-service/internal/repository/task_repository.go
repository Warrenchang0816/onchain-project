package repository

import (
	"database/sql"
	"go-service/internal/model"
)

type TaskRepository struct {
	db *sql.DB
}

func NewTaskRepository(db *sql.DB) *TaskRepository {
	return &TaskRepository{db: db}
}

func (r *TaskRepository) FindAll() ([]model.Task, error) {
	rows, err := r.db.Query(`
        SELECT id, task_id, wallet_address, assignee_wallet_address, title, description, status, priority,
               reward_amount, fee_bps, chain_id, vault_contract_address, contract_task_id,
               onchain_status, fund_tx_hash, approve_tx_hash, claim_tx_hash, cancel_tx_hash,
               due_date, created_at, updated_at
        FROM tasks
        ORDER BY created_at DESC
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]model.Task, 0)

	for rows.Next() {
		var task model.Task
		err := rows.Scan(
			&task.ID,
			&task.TaskID,
			&task.WalletAddress,
			&task.AssigneeWalletAddress,
			&task.Title,
			&task.Description,
			&task.Status,
			&task.Priority,
			&task.RewardAmount,
			&task.FeeBps,
			&task.ChainID,
			&task.VaultContractAddress,
			&task.ContractTaskID,
			&task.OnchainStatus,
			&task.FundTxHash,
			&task.ApproveTxHash,
			&task.ClaimTxHash,
			&task.CancelTxHash,
			&task.DueDate,
			&task.CreatedAt,
			&task.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return tasks, nil
}

func (r *TaskRepository) Create(task model.Task) (int64, error) {
	var id int64

	err := r.db.QueryRow(`
        INSERT INTO tasks (
            task_id, wallet_address, assignee_wallet_address, title, description, status, priority,
            reward_amount, fee_bps, chain_id, vault_contract_address, contract_task_id,
            onchain_status, due_date, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        RETURNING id
    `,
		task.TaskID,
		task.WalletAddress,
		task.AssigneeWalletAddress,
		task.Title,
		task.Description,
		task.Status,
		task.Priority,
		task.RewardAmount,
		task.FeeBps,
		task.ChainID,
		task.VaultContractAddress,
		task.ContractTaskID,
		task.OnchainStatus,
		task.DueDate,
	).Scan(&id)

	if err != nil {
		return 0, err
	}

	return id, nil
}

func (r *TaskRepository) FindByID(id int64) (*model.Task, error) {
	var task model.Task

	err := r.db.QueryRow(`
        SELECT id, task_id, wallet_address, assignee_wallet_address, title, description, status, priority,
               reward_amount, fee_bps, chain_id, vault_contract_address, contract_task_id,
               onchain_status, fund_tx_hash, approve_tx_hash, claim_tx_hash, cancel_tx_hash,
               due_date, created_at, updated_at
        FROM tasks
        WHERE id = $1
    `, id).Scan(
		&task.ID,
		&task.TaskID,
		&task.WalletAddress,
		&task.AssigneeWalletAddress,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.Priority,
		&task.RewardAmount,
		&task.FeeBps,
		&task.ChainID,
		&task.VaultContractAddress,
		&task.ContractTaskID,
		&task.OnchainStatus,
		&task.FundTxHash,
		&task.ApproveTxHash,
		&task.ClaimTxHash,
		&task.CancelTxHash,
		&task.DueDate,
		&task.CreatedAt,
		&task.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &task, nil
}

func (r *TaskRepository) Update(task model.Task) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET title = $1,
            description = $2,
            priority = $3,
            due_date = $4,
            updated_at = NOW()
        WHERE id = $5
    `,
		task.Title,
		task.Description,
		task.Priority,
		task.DueDate,
		task.ID,
	)

	return err
}

func (r *TaskRepository) UpdateStatus(id int64, status string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET status = $1,
            updated_at = NOW()
        WHERE id = $2
    `, status, id)

	return err
}

func (r *TaskRepository) UpdateTaskAssignee(id int64, assigneeWalletAddress string, status string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET assignee_wallet_address = $1,
            status = $2,
            updated_at = NOW()
        WHERE id = $3
    `, assigneeWalletAddress, status, id)

	return err
}

func (r *TaskRepository) UpdateFundInfo(
	id int64,
	chainID int64,
	vaultContractAddress string,
	contractTaskID string,
	onchainStatus string,
	txHash string,
) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET chain_id = $1,
            vault_contract_address = $2,
            contract_task_id = $3,
            onchain_status = $4,
            fund_tx_hash = $5,
            updated_at = NOW()
        WHERE id = $6
    `, chainID, vaultContractAddress, contractTaskID, onchainStatus, txHash, id)

	return err
}

func (r *TaskRepository) UpdateApproveInfo(id int64, status string, onchainStatus string, txHash string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET status = $1,
            onchain_status = $2,
            approve_tx_hash = $3,
            updated_at = NOW()
        WHERE id = $4
    `, status, onchainStatus, txHash, id)

	return err
}

func (r *TaskRepository) UpdateClaimInfo(id int64, status string, onchainStatus string, txHash string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET status = $1,
            onchain_status = $2,
            claim_tx_hash = $3,
            updated_at = NOW()
        WHERE id = $4
    `, status, onchainStatus, txHash, id)

	return err
}

func (r *TaskRepository) UpdateCancelInfo(id int64, status string, onchainStatus string, txHash string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET status = $1,
            onchain_status = $2,
            cancel_tx_hash = $3,
            updated_at = NOW()
        WHERE id = $4
    `, status, onchainStatus, txHash, id)

	return err
}

func (r *TaskRepository) CreateSubmission(taskID string, walletAddress, resultContent, resultFileURL, resultHash string) error {
	var fileURL interface{}
	if resultFileURL != "" {
		fileURL = resultFileURL
	}

	var hash interface{}
	if resultHash != "" {
		hash = resultHash
	}

	_, err := r.db.Exec(`
        INSERT INTO task_submissions (task_id, submitted_by_wallet_address, result_content, result_file_url, result_hash)
        VALUES ($1, $2, $3, $4, $5)
    `, taskID, walletAddress, resultContent, fileURL, hash)

	return err
}

func (r *TaskRepository) UpdateAssignInfo(id int64, onchainStatus string) error {
	_, err := r.db.Exec(`
        UPDATE tasks
        SET onchain_status = $1,
            updated_at = NOW()
        WHERE id = $2
    `, onchainStatus, id)

	return err
}
