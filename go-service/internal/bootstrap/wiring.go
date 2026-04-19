package bootstrap

import (
	"context"
	"log"

	"go-service/internal/db/repository"
	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
	"go-service/internal/platform/faceai"
	platdb "go-service/internal/platform/db"
	"go-service/internal/platform/indexer"
	"go-service/internal/platform/notify"
	"go-service/internal/platform/ocr"
	"go-service/internal/platform/storage"
	authmod "go-service/internal/modules/auth"
	listingmod "go-service/internal/modules/listing"
	logsmod "go-service/internal/modules/logs"
	onboardingmod "go-service/internal/modules/onboarding"
	usermod "go-service/internal/modules/user"

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
	ekycConfig := config.LoadEKYCConfig()

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
	logRepo := repository.NewBlockchainLogRepository(postgresDB)
	nonceRepo := repository.NewNonceRepository(postgresDB)
	sessionRepo := repository.NewSessionRepository(postgresDB)
	userRepo := repository.NewUserRepository(postgresDB)
	kycRepo := repository.NewKYCSubmissionRepository(postgresDB)
	otpRepo := repository.NewOTPRepository(postgresDB)
	kycSessionRepo := repository.NewKYCSessionRepository(postgresDB)
	credentialRepo := repository.NewUserCredentialRepository(postgresDB)
	listingRepo := repository.NewListingRepository(postgresDB)
	apptRepo := repository.NewListingAppointmentRepository(postgresDB)

	// ── 5. Logs module ────────────────────────────────────────
	logHandler := logsmod.NewHandler(logRepo)

	// ── 6. Auth module ────────────────────────────────────────
	siweCfg := config.LoadSIWEConfig()
	authHandler := authmod.NewHandler(nonceRepo, sessionRepo)
	loginHandler := authmod.NewLoginHandler(userRepo, sessionRepo, nonceRepo, siweCfg)

	// ── 7. eKYC platform services ─────────────────────────────
	minioClient, err := storage.NewClient(
		ekycConfig.MinIOEndpoint,
		ekycConfig.MinIOAccessKey,
		ekycConfig.MinIOSecretKey,
		ekycConfig.MinIOBucket,
		ekycConfig.MinIOUseSSL,
	)
	if err != nil {
		log.Printf("[bootstrap] MinIO client init failed: %v (KYC uploads disabled)", err)
		minioClient = nil
	}

	var visionClient *ocr.VisionClient
	if ekycConfig.GoogleVisionAPIKey != "" {
		visionClient = ocr.NewVisionClient(ekycConfig.GoogleVisionAPIKey)
	}

	var rekognitionClient *faceai.RekognitionClient
	if ekycConfig.AWSAccessKeyID != "" {
		rekognitionClient, err = faceai.NewRekognitionClient(
			ekycConfig.AWSAccessKeyID,
			ekycConfig.AWSSecretAccessKey,
			ekycConfig.AWSRegion,
		)
		if err != nil {
			log.Printf("[bootstrap] Rekognition client init failed: %v (face match disabled)", err)
		}
	}

	// ── 8. Indexer (on-demand) ────────────────────────────────
	var chainSyncer onboardingmod.ChainSyncer
	var cleanupFn func()
	if ethClient != nil {
		ethClient.StartHealthLoop(ctx)

		checkpointStore := indexer.NewCheckpointStore(postgresDB)
		idx := indexer.New(ethClient, postgresDB, blockchainConfig)

		if blockchainConfig.IdentityNFTAddress != "" {
			identityWorker, err := usermod.NewIdentityWorker(
				blockchainConfig.IdentityNFTAddress,
				userRepo,
				checkpointStore,
				blockchainConfig.IdentityNFTStartBlock,
			)
			if err != nil {
				log.Printf("[bootstrap] identity worker init failed: %v", err)
			} else {
				idx.RegisterWorker(identityWorker)
			}
		}

		chainSyncer = idx
		cleanupFn = func() { ethClient.Close() }
		log.Println("[bootstrap] blockchain indexer ready (on-demand mode)")
	} else {
		cleanupFn = func() {}
	}

	// ── 9. User / KYC module ──────────────────────────────────
	identityContractSvc, err := usermod.NewIdentityContractService(blockchainConfig)
	if err != nil {
		return nil, nil, err
	}

	// ── 10. Notify services ───────────────────────────────────
	notifyConfig := config.LoadNotifyConfig()
	siweConfig := config.LoadSIWEConfig()

	emailSender := notify.NewEmailSender(notify.EmailConfig{
		Host: notifyConfig.SMTPHost,
		Port: notifyConfig.SMTPPort,
		User: notifyConfig.SMTPUser,
		Pass: notifyConfig.SMTPPass,
		From: notifyConfig.SMTPFrom,
	})
	smsSender := notify.NewMitakeSender(notify.MitakeConfig{
		Username: notifyConfig.MitakeUsername,
		Password: notifyConfig.MitakePassword,
	})

	// ── 10b. Reset-password handler (needs emailSender) ──────
	resetPasswordHandler := authmod.NewResetPasswordHandler(userRepo, otpRepo, emailSender)

	// ── 11. Onboarding module ─────────────────────────────────
	onboardingSvc := onboardingmod.NewService(
		otpRepo,
		kycSessionRepo,
		userRepo,
		kycRepo,
		nonceRepo,
		sessionRepo,
		emailSender,
		smsSender,
		minioClient,
		visionClient,
		rekognitionClient,
		identityContractSvc,
		ekycConfig,
		notifyConfig,
		siweConfig,
		chainSyncer,
	)
	onboardingHandler := onboardingmod.NewHandler(onboardingSvc)

	// ── 12. User module ───────────────────────────────────────
	userSvc := usermod.NewService(
		userRepo,
		kycRepo,
		credentialRepo,
		otpRepo,
		identityContractSvc,
		ekycConfig,
		minioClient,
		visionClient,
		rekognitionClient,
		chainSyncer,
		emailSender,
		smsSender,
	)
	userHandler := usermod.NewHandler(userSvc)
	adminHandler := usermod.NewAdminHandler(userSvc, blockchainConfig.GodModeWalletAddress)

	// ── 13. Listing module ────────────────────────────────────
	listingSvc := listingmod.NewService(listingRepo, apptRepo, userRepo)
	listingHandler := listingmod.NewHandler(listingSvc)

	// ── 14. Router ────────────────────────────────────────────
	r := SetupRouter(listingHandler, logHandler, authHandler, loginHandler, resetPasswordHandler, userHandler, adminHandler, onboardingHandler, sessionRepo)

	return r, cleanupFn, nil
}
