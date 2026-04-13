package indexer

import (
	"context"
	"database/sql"
	"fmt"
)

// CheckpointStore 負責讀寫 indexer_checkpoints 表。
// 每個合約以 contractName 為 primary key 追蹤最後處理的 block。
type CheckpointStore struct {
	db *sql.DB
}

// NewCheckpointStore 建立 CheckpointStore 實例。
func NewCheckpointStore(db *sql.DB) *CheckpointStore {
	return &CheckpointStore{db: db}
}

// GetLastBlock 取得指定合約最後處理到的 block number。
// 若尚無記錄（通常不會發生，SQL 初始化時已預插入），返回 0。
func (s *CheckpointStore) GetLastBlock(ctx context.Context, contractName string) (uint64, error) {
	var block uint64
	err := s.db.QueryRowContext(ctx,
		`SELECT last_processed_block FROM indexer_checkpoints WHERE contract_name = $1`,
		contractName,
	).Scan(&block)

	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("checkpoint: get %s: %w", contractName, err)
	}
	return block, nil
}

// SaveBlock 更新指定合約的最後處理 block number。
// 使用 UPSERT 確保即使記錄不存在也能正確插入。
func (s *CheckpointStore) SaveBlock(ctx context.Context, contractName string, blockNumber uint64) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO indexer_checkpoints (contract_name, last_processed_block, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (contract_name) DO UPDATE
		  SET last_processed_block = EXCLUDED.last_processed_block,
		      updated_at           = EXCLUDED.updated_at
	`, contractName, blockNumber)

	if err != nil {
		return fmt.Errorf("checkpoint: save %s block %d: %w", contractName, blockNumber, err)
	}
	return nil
}

// MarkProcessed 將 (tx_hash, log_index) 記錄至 processed_events。
// 若已存在則忽略（冪等），返回 true 表示第一次處理、false 表示已重複。
func (s *CheckpointStore) MarkProcessed(
	ctx context.Context,
	txHash string,
	logIndex uint,
	contractName string,
	eventName string,
	blockNumber uint64,
) (isNew bool, err error) {
	result, err := s.db.ExecContext(ctx, `
		INSERT INTO processed_events (tx_hash, log_index, contract_name, event_name, block_number)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (tx_hash, log_index) DO NOTHING
	`, txHash, logIndex, contractName, eventName, blockNumber)

	if err != nil {
		return false, fmt.Errorf("checkpoint: mark processed %s#%d: %w", txHash, logIndex, err)
	}

	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
