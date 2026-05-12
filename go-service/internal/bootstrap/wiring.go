package bootstrap

import (
	"context"
	"log"
	"os"

	"go-service/internal/db/repository"
	agentmod "go-service/internal/modules/agent"
	authmod "go-service/internal/modules/auth"
	credentialmod "go-service/internal/modules/credential"
	customermod "go-service/internal/modules/customer"
	favoritesmod "go-service/internal/modules/favorites"
	listingmod "go-service/internal/modules/listing"
	locationmod "go-service/internal/modules/location"
	logsmod "go-service/internal/modules/logs"
	onboardingmod "go-service/internal/modules/onboarding"
	propertymod "go-service/internal/modules/property"
	rentallistingmod "go-service/internal/modules/rental_listing"
	salelistingmod "go-service/internal/modules/sale_listing"
	tenantmod "go-service/internal/modules/tenant"
	usermod "go-service/internal/modules/user"
	"go-service/internal/platform/blockchain"
	"go-service/internal/platform/config"
	platdb "go-service/internal/platform/db"
	"go-service/internal/platform/faceai"
	"go-service/internal/platform/indexer"
	"go-service/internal/platform/notify"
	"go-service/internal/platform/ocr"
	"go-service/internal/platform/storage"

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
	credentialSubmissionRepo := repository.NewCredentialSubmissionRepository(postgresDB)
	listingRepo := repository.NewListingRepository(postgresDB)
	propertyRepo := repository.NewCustomerRepository(postgresDB)
	apptRepo := repository.NewListingAppointmentRepository(postgresDB)
	tenantProfileRepo := repository.NewTenantProfileRepository(postgresDB)
	tenantRequirementRepo := repository.NewTenantRequirementRepository(postgresDB)
	agentProfileRepo := repository.NewAgentProfileRepository(postgresDB)
	locationRepo := repository.NewLocationRepository(postgresDB)
	newPropertyRepo := repository.NewPropertyRepository(postgresDB)
	rentalListingRepo := repository.NewRentalListingRepository(postgresDB)
	saleListingRepo := repository.NewSaleListingRepository(postgresDB)
	favoritesRepo := favoritesmod.NewRepository(postgresDB)

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

			credentialWorker, err := credentialmod.NewWorker(
				blockchainConfig.IdentityNFTAddress,
				userRepo,
				credentialRepo,
				checkpointStore,
				blockchainConfig.IdentityNFTStartBlock,
			)
			if err != nil {
				log.Printf("[bootstrap] credential worker init failed: %v", err)
			} else {
				idx.RegisterWorker(credentialWorker)
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

	// ── 13. Listing and credential modules ────────────────────────────────────────
	customerSvc := customermod.NewService(propertyRepo, userRepo)
	customerHandler := customermod.NewHandler(customerSvc)
	listingSvc := listingmod.NewService(listingRepo, apptRepo, userRepo, propertyRepo)
	listingHandler := listingmod.NewHandler(listingSvc)

	credentialSvc := credentialmod.NewService(
		userRepo,
		credentialSubmissionRepo,
		credentialRepo,
		identityContractSvc,
		minioClient,
		visionClient,
		chainSyncer,
		customerSvc,
		listingSvc,
	)
	credentialHandler := credentialmod.NewHandler(credentialSvc)
	credentialAdminHandler := credentialmod.NewAdminHandler(credentialSvc, blockchainConfig.GodModeWalletAddress)

	// ── 14. Agent directory module ────────────────────────────
	agentSvc := agentmod.NewService(credentialRepo, agentProfileRepo, userRepo)
	agentHandler := agentmod.NewHandler(agentSvc)
	locationSvc := locationmod.NewService(locationRepo)
	locationHandler := locationmod.NewHandler(locationSvc)

	// ── 15. New property + listing modules ───────────────────────────────────
	appPublicURL := os.Getenv("APP_PUBLIC_URL")
	if appPublicURL == "" {
		appPublicURL = "http://localhost:8081"
	}
	newPropertySvc := propertymod.NewService(newPropertyRepo, userRepo, minioClient, appPublicURL)
	newPropertyHandler := propertymod.NewHandler(newPropertySvc)

	rentalListingSvc := rentallistingmod.NewService(rentalListingRepo, newPropertyRepo, userRepo)
	rentalListingHandler := rentallistingmod.NewHandler(rentalListingSvc)

	saleListingSvc := salelistingmod.NewService(saleListingRepo, newPropertyRepo, userRepo)
	saleListingHandler := salelistingmod.NewHandler(saleListingSvc)

	// ── 16. Tenant module ─────────────────────────────────────
	tenantSvc := tenantmod.NewService(
		userRepo,
		credentialRepo,
		tenantProfileRepo,
		tenantRequirementRepo,
		minioClient,
	)
	tenantHandler := tenantmod.NewHandler(tenantSvc)

	// ── 17. Favorites module ──────────────────────────────────
	favoritesHandler := favoritesmod.NewHandler(favoritesRepo)

	// ── 16. Router ────────────────────────────────────────────
	r := SetupRouter(
		listingHandler,
		logHandler,
		authHandler,
		loginHandler,
		resetPasswordHandler,
		userHandler,
		adminHandler,
		onboardingHandler,
		credentialHandler,
		credentialAdminHandler,
		sessionRepo,
		agentHandler,
		tenantHandler,
		customerHandler,
		locationHandler,
		newPropertyHandler,
		rentalListingHandler,
		saleListingHandler,
		favoritesHandler,
	)

	return r, cleanupFn, nil
}
