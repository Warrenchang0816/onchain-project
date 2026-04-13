package bootstrap

import (
	"context"
	"log"

	"go-service/internal/db/repository"
	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
	platdb "go-service/internal/platform/db"
	"go-service/internal/platform/indexer"
	authmod "go-service/internal/modules/auth"
	"go-service/internal/modules/task"

	"github.com/gin-gonic/gin"
)

func Wire(ctx context.Context) (*gin.Engine, func(), error) {
	// ── 1. 資料庫 ─────────────────────────────────────────────
	postgresDB, err := platdb.NewPostgresDB()
	if err != nil {
		return nil, nil, err
	}

	// ── 2. 設定 ───────────────────────────────────────────────
	blockchainConfig := config.LoadBlockchainConfig()

	// ── 3. 區塊鏈客戶端（Indexer 只讀連線）───────────────────
	var ethClient *blockchain.Client
	if blockchainConfig.RPCURL != "" {
		ethClient, err = blockchain.NewClient(
			blockchainConfig.RPCURL,
			blockchainConfig.RPCURLFallback,
		)
		if err != nil {
			log.Printf("[bootstrap] blockchain client init failed: %v (indexer disabled)", err)
		}
	}

	// ── 4. Repositories ───────────────────────────────────────
	taskRepo := repository.NewTaskRepository(postgresDB)
	logRepo := repository.NewBlockchainLogRepository(postgresDB)
	nonceRepo := repository.NewNonceRepository(postgresDB)
	sessionRepo := repository.NewSessionRepository(postgresDB)

	// ── 5. Task module ────────────────────────────────────────
	taskPermissionSvc := task.NewTaskPermissionService(blockchainConfig.GodModeWalletAddress)

	taskRewardVaultSvc, err := task.NewTaskRewardVaultService()
	if err != nil {
		return nil, nil, err
	}

	taskSvc := task.NewTaskService(
		taskRepo,
		logRepo,
		taskPermissionSvc,
		blockchainConfig.PlatformFeeBps,
		taskRewardVaultSvc,
		blockchainConfig,
	)
	taskHandler := task.NewTaskHandler(taskSvc, taskPermissionSvc)
	logHandler := task.NewBlockchainLogHandler(logRepo)

	// ── 6. Auth module ────────────────────────────────────────
	authHandler := authmod.NewHandler(nonceRepo, sessionRepo)

	// ── 7. Indexer ────────────────────────────────────────────
	var cleanupFn func()
	if ethClient != nil {
		ethClient.StartHealthLoop(ctx)

		idx := indexer.New(ethClient, postgresDB, blockchainConfig)
		// 未來各合約 worker 在此 RegisterWorker：
		//   idx.RegisterWorker(identity.NewWorker(...))
		//   idx.RegisterWorker(property.NewWorker(...))
		idx.Start(ctx)

		cleanupFn = func() { ethClient.Close() }
		log.Println("[bootstrap] blockchain indexer started")
	} else {
		cleanupFn = func() {}
	}

	// ── 8. Router ─────────────────────────────────────────────
	r := SetupRouter(taskHandler, logHandler, authHandler, sessionRepo)

	return r, cleanupFn, nil
}
