package indexer

import (
	"context"
	"database/sql"
	"log"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
)

// Syncer is a minimal interface for on-demand chain sync.
// Services accept this interface so they can trigger a sync before/after contract calls.
type Syncer interface {
	SyncAll(ctx context.Context) error
}

// ContractWorker 定義單一合約的 Indexer 工作介面。
// 每個合約（IdentityNFT、PropertyRegistry…）各自實作此介面。
type ContractWorker interface {
	// ContractName 回傳用於 checkpoint/processed_events 的合約識別名稱。
	ContractName() string

	// Address 回傳此合約在鏈上的地址。
	Address() common.Address

	// StartBlock 回傳此合約應從哪個 block 開始掃描（通常為部署 block）。
	// 回傳 0 表示不限制，從 checkpoint 記錄的 block 繼續。
	StartBlock() uint64

	// ProcessBlock 處理單一 block 內屬於此合約的 logs。
	// blockNumber 為已達確認深度的目標 block。
	ProcessBlock(ctx context.Context, eth *ethclient.Client, blockNumber uint64) error
}

// Indexer 是所有合約 worker 的協調器。
//
// 採用 on-demand 模式：不持續輪詢，呼叫 SyncAll() 時才同步。
// 典型用法：在呼叫鏈上合約前後呼叫 SyncAll() 以確保 DB 狀態最新。
type Indexer struct {
	client     *blockchain.Client
	checkpoint *CheckpointStore
	workers    []ContractWorker
	cfg        *config.BlockchainConfig
}

// New 建立 Indexer，注入 blockchain.Client、DB、設定與 workers。
// workers 可為空（稍後透過 RegisterWorker 加入）。
func New(
	client *blockchain.Client,
	db *sql.DB,
	cfg *config.BlockchainConfig,
	workers ...ContractWorker,
) *Indexer {
	return &Indexer{
		client:     client,
		checkpoint: NewCheckpointStore(db),
		workers:    workers,
		cfg:        cfg,
	}
}

// RegisterWorker 動態加入合約 worker（在 SyncAll 之前呼叫）。
func (idx *Indexer) RegisterWorker(w ContractWorker) {
	idx.workers = append(idx.workers, w)
}

// SyncAll 立即同步所有已註冊的 worker（on-demand，不輪詢）。
// 在呼叫合約前或合約 tx confirmed 後呼叫，確保 DB 狀態與鏈上一致。
func (idx *Indexer) SyncAll(ctx context.Context) error {
	for _, w := range idx.workers {
		if err := idx.syncWorker(ctx, w); err != nil {
			log.Printf("[indexer:%s] SyncAll error: %v", w.ContractName(), err)
			return err
		}
	}
	return nil
}

func (idx *Indexer) syncWorker(ctx context.Context, worker ContractWorker) error {
	eth := idx.client.Eth()
	name := worker.ContractName()

	// 1. 取得目前鏈上最新 block
	latestBlock, err := eth.BlockNumber(ctx)
	if err != nil {
		return err
	}

	// 2. 扣除確認深度（防 re-org）
	if latestBlock < idx.cfg.ConfirmationBlocks {
		return nil // 鏈還很新，等候更多確認
	}
	safeBlock := latestBlock - idx.cfg.ConfirmationBlocks

	// 3. 取得 checkpoint，並尊重 worker 的 StartBlock（若 checkpoint 比 startBlock 早，跳到 startBlock）
	lastBlock, err := idx.checkpoint.GetLastBlock(ctx, name)
	if err != nil {
		return err
	}
	if startBlock := worker.StartBlock(); startBlock > 0 && lastBlock < startBlock-1 {
		lastBlock = startBlock - 1
	}

	if lastBlock >= safeBlock {
		return nil // 已跟上，無需處理
	}

	// 4. 逐 block 處理（限制每次最多掃 100 個 block，避免單次過久）
	const maxBlocksPerSync = 100
	from := lastBlock + 1
	to := safeBlock
	if to-from+1 > maxBlocksPerSync {
		to = from + maxBlocksPerSync - 1
	}

	for blockNum := from; blockNum <= to; blockNum++ {
		if err := worker.ProcessBlock(ctx, eth, blockNum); err != nil {
			// 記錄錯誤但不中斷；下次 tick 會從同一 block 重試
			log.Printf("[indexer:%s] ProcessBlock(%d) error: %v", name, blockNum, err)
			return err
		}

		if err := idx.checkpoint.SaveBlock(ctx, name, blockNum); err != nil {
			return err
		}
	}

	if to > from {
		log.Printf("[indexer:%s] synced blocks %d–%d", name, from, to)
	}

	return nil
}
