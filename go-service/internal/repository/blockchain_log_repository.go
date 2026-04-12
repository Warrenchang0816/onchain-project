package repository

import (
	"database/sql"
	"go-service/internal/model"
)

type BlockchainLogRepository struct {
	db *sql.DB
}

func NewBlockchainLogRepository(db *sql.DB) *BlockchainLogRepository {
	return &BlockchainLogRepository{db: db}
}

func (r *BlockchainLogRepository) Create(log model.BlockchainLog) error {
	_, err := r.db.Exec(`
        INSERT INTO task_blockchain_logs (task_id, action, tx_hash, chain_id, contract_address, status)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, log.TaskID, log.Action, log.TxHash, log.ChainID, log.ContractAddress, log.Status)
	return err
}

func (r *BlockchainLogRepository) FindAll() ([]model.BlockchainLog, error) {
	rows, err := r.db.Query(`
        SELECT l.id, l.task_id, COALESCE(t.wallet_address, '') AS wallet_address,
               l.action, l.tx_hash, l.chain_id, l.contract_address, l.status, l.created_at
        FROM task_blockchain_logs l
        LEFT JOIN tasks t ON l.task_id = t.task_id
        ORDER BY l.created_at DESC
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]model.BlockchainLog, 0)
	for rows.Next() {
		var l model.BlockchainLog
		if err := rows.Scan(
			&l.ID, &l.TaskID, &l.WalletAddress, &l.Action, &l.TxHash,
			&l.ChainID, &l.ContractAddress, &l.Status, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}
