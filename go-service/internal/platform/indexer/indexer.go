package indexer

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"

	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
)

// ContractWorker 定義單一合約的 Indexer 工作介面。
// 每個合約（IdentityNFT、PropertyRegistry…）各自實作此介面。
type ContractWorker interface {
	// ContractName 回傳用於 checkpoint/processed_events 的合約識別名稱。
	ContractName() string

	// Address 回傳此合約在鏈上的地址。
	Address() common.Address

	// ProcessBlock 處理單一 block 內屬於此合約的 logs。
	// blockNumber 為已達確認深度的目標 block。
	ProcessBlock(ctx context.Context, eth *ethclient.Client, blockNumber uint64) error
}

// Indexer 是所有合約 worker 的協調器。
//
// 工作流程：
//  1. 每個 worker 從 checkpoint 取得 lastBlock
//  2. 輪詢最新 block（每 PollInterval 一次）
//  3. 扣除 ConfirmationBlocks 深度，逐 block 呼叫 worker.ProcessBlock
//  4. 每處理完一個 block 後更新 checkpoint
type Indexer struct {
	client     *blockchain.Client
	checkpoint *CheckpointStore
	workers    []ContractWorker
	cfg        *config.BlockchainConfig

	pollInterval time.Duration
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
		client:       client,
		checkpoint:   NewCheckpointStore(db),
		workers:      workers,
		cfg:          cfg,
		pollInterval: 12 * time.Second, // Ethereum ~12s per block
	}
}

// RegisterWorker 動態加入合約 worker（在 Start 之前呼叫）。
func (idx *Indexer) RegisterWorker(w ContractWorker) {
	idx.workers = append(idx.workers, w)
}

// Start 啟動所有 worker goroutine。
// 每個 worker 獨立運行，互不阻塞。
// 傳入 ctx 可取消所有 worker。
func (idx *Indexer) Start(ctx context.Context) {
	var wg sync.WaitGroup
	for _, w := range idx.workers {
		wg.Add(1)
		go func(worker ContractWorker) {
			defer wg.Done()
			idx.runWorker(ctx, worker)
		}(w)
	}

	// 在背景等待 ctx 取消後所有 worker 退出
	go func() {
		wg.Wait()
		log.Println("[indexer] all workers stopped")
	}()
}

// ─────────────────────────────────────────────
// 內部方法
// ─────────────────────────────────────────────

func (idx *Indexer) runWorker(ctx context.Context, worker ContractWorker) {
	name := worker.ContractName()
	log.Printf("[indexer:%s] worker started", name)

	ticker := time.NewTicker(idx.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[indexer:%s] worker stopped", name)
			return
		case <-ticker.C:
			if err := idx.syncWorker(ctx, worker); err != nil {
				log.Printf("[indexer:%s] sync error: %v", name, err)
			}
		}
	}
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

	// 3. 取得 checkpoint
	lastBlock, err := idx.checkpoint.GetLastBlock(ctx, name)
	if err != nil {
		return err
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
