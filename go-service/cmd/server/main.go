package main

import (
	"go-service/internal/config"
	"go-service/internal/db"
	"go-service/internal/handler"
	"go-service/internal/repository"
	"go-service/internal/router"
	"go-service/internal/service"
	"log"
)

func main() {
	postgresDB, err := db.NewPostgresDB()
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	taskRepo := repository.NewTaskRepository(postgresDB)
	logRepo := repository.NewBlockchainLogRepository(postgresDB)
	blockchainConfig := config.LoadBlockchainConfig()

	taskPermissionSvc := service.NewTaskPermissionService(blockchainConfig.GodModeWalletAddress)

	taskRewardVaultSvc, err := service.NewTaskRewardVaultService()
	if err != nil {
		log.Fatalf("failed to init task reward vault service: %v", err)
	}

	taskService := service.NewTaskService(
		taskRepo,
		logRepo,
		taskPermissionSvc,
		blockchainConfig.PlatformFeeBps,
		taskRewardVaultSvc,
		blockchainConfig,
	)
	taskHandler := handler.NewTaskHandler(taskService, taskPermissionSvc)
	logHandler := handler.NewBlockchainLogHandler(logRepo)
	authHandler := handler.NewAuthHandler(postgresDB)

	r := router.SetupRouter(taskHandler, logHandler, authHandler)

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
