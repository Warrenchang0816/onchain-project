package config

import "strconv"

type DBConfig struct {
	DBHost    string
	DBPort    string
	DBUser    string
	DBPass    string
	DBName    string
	DBSSLMode string
}

func LoadDBConfig() DBConfig {
	return DBConfig{
		DBHost:    GetEnv("DB_HOST", ""),
		DBPort:    GetEnv("DB_PORT", ""),
		DBUser:    GetEnv("DB_USER", ""),
		DBPass:    GetEnv("DB_PASS", ""),
		DBName:    GetEnv("DB_NAME", ""),
		DBSSLMode: GetEnv("DB_SSLMODE", ""),
	}
}

type SIWEConfig struct {
	AppDomain         string
	AppURI            string
	SIWEStatement     string
	SIWEVersion       string
	SIWEChainID       string
	NonceExpire       string
	AuthSessionExpire string
	AuthCookieName    string
	AuthSessionSecure string
}

func LoadSIWEConfig() *SIWEConfig {
	return &SIWEConfig{
		AppDomain:         GetEnv("APP_DOMAIN", "localhost:5173"),
		AppURI:            GetEnv("APP_URI", "http://localhost:5173"),
		SIWEStatement:     GetEnv("SIWE_STATEMENT", "Sign in to Trusted Housing Platform."),
		SIWEVersion:       GetEnv("SIWE_VERSION", "1"),
		SIWEChainID:       GetEnv("SIWE_CHAIN_ID", "11155111"),
		NonceExpire:       GetEnv("SIWE_NONCE_EXPIRE", "300"),
		AuthSessionExpire: GetEnv("AUTH_SESSION_EXPIRE", "86400"),
		AuthCookieName:    GetEnv("AUTH_COOKIE_NAME", "go_service_session"),
		AuthSessionSecure: GetEnv("AUTH_SESSION_SECURE", "false"),
	}
}

type BlockchainConfig struct {
	// 舊任務追蹤功能（保留相容）
	GodModeWalletAddress    string
	ChainID                 int64
	RPCURL                  string
	RewardVaultAddress      string
	PlatformFeeBps          int
	PlatformTreasuryAddr    string
	PlatformOperatorPrivKey string

	// 房屋平台：RPC（只讀，無私鑰）
	RPCURLFallback     string // 備用 RPC，主 RPC 斷線時切換
	ConfirmationBlocks uint64 // 事件確認後等待幾個 block 再寫 DB

	// 房屋平台合約地址
	IdentityNFTAddress       string
	IdentityNFTStartBlock    uint64
	PropertyRegistryAddress  string
	AgencyRegistryAddress    string
	ListingStakeVaultAddress string
	CaseTrackerAddress       string
}

// EKYCConfig holds credentials for the eKYC pipeline:
// Google Cloud Vision (OCR), AWS Rekognition (face match), and MinIO (image storage).
type EKYCConfig struct {
	// Google Cloud Vision REST API key (TEXT_DETECTION)
	GoogleVisionAPIKey string

	// AWS Rekognition
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	AWSRegion          string // e.g. "ap-northeast-1"

	// MinIO (S3-compatible self-hosted object storage)
	MinIOEndpoint  string // e.g. "localhost:9000"
	MinIOAccessKey string
	MinIOSecretKey string
	MinIOBucket    string
	MinIOUseSSL    bool

	// Face-match thresholds
	FaceAutoPassScore     float32 // ≥ this → AUTO_VERIFIED (default 80)
	FaceManualReviewScore float32 // ≥ this → MANUAL_REVIEW  (default 60)

	// DevAutoApprove=true skips OCR/face checks and auto-verifies KYC.
	// Automatically enabled when no Vision/Rekognition keys are configured.
	// Override with KYC_DEV_AUTO_APPROVE=false to disable.
	DevAutoApprove bool

	// Frontend base URL (for post-KYC redirect hints in error responses)
	FrontendURL string
}

func LoadEKYCConfig() *EKYCConfig {
	autoPass, _ := strconv.ParseFloat(GetEnv("KYC_FACE_AUTO_PASS_SCORE", "80"), 32)
	manualReview, _ := strconv.ParseFloat(GetEnv("KYC_FACE_MANUAL_REVIEW_SCORE", "60"), 32)

	visionKey := GetEnv("GOOGLE_VISION_API_KEY", "")
	awsKey := GetEnv("AWS_ACCESS_KEY_ID", "")
	// DevAutoApprove defaults to true when no external AI services are configured,
	// unless explicitly overridden by KYC_DEV_AUTO_APPROVE=false.
	devAutoApproveDefault := visionKey == "" && awsKey == ""
	devAutoApproveEnv := GetEnv("KYC_DEV_AUTO_APPROVE", "")
	devAutoApprove := devAutoApproveDefault
	if devAutoApproveEnv == "true" {
		devAutoApprove = true
	} else if devAutoApproveEnv == "false" {
		devAutoApprove = false
	}

	return &EKYCConfig{
		GoogleVisionAPIKey:    visionKey,
		AWSAccessKeyID:        awsKey,
		AWSSecretAccessKey:    GetEnv("AWS_SECRET_ACCESS_KEY", ""),
		AWSRegion:             GetEnv("AWS_REGION", "ap-northeast-1"),
		MinIOEndpoint:         GetEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinIOAccessKey:        GetEnv("MINIO_ACCESS_KEY", "minioadmin"),
		MinIOSecretKey:        GetEnv("MINIO_SECRET_KEY", "minioadmin"),
		MinIOBucket:           GetEnv("MINIO_BUCKET", "kyc"),
		MinIOUseSSL:           GetEnv("MINIO_USE_SSL", "false") == "true",
		FaceAutoPassScore:     float32(autoPass),
		FaceManualReviewScore: float32(manualReview),
		DevAutoApprove:        devAutoApprove,
		FrontendURL:           GetEnv("APP_FRONTEND_URL", "http://localhost:5173"),
	}
}

// NotifyConfig holds credentials for OTP delivery (email via SMTP + SMS via Mitake).
type NotifyConfig struct {
	// SMTP (email OTP)
	SMTPHost string // e.g. "smtp.gmail.com"; empty = dev/log-only mode
	SMTPPort string // e.g. "587"
	SMTPUser string
	SMTPPass string
	SMTPFrom string // e.g. "no-reply@yourdomain.com"

	// 三竹簡訊 (SMS OTP)
	MitakeUsername string // empty = dev/log-only mode
	MitakePassword string

	// OTP / session settings
	OTPExpirySecs     int // default 300 (5 min)
	KYCSessionTTLMins int // default 30
}

func LoadNotifyConfig() *NotifyConfig {
	otpExpiry := 300
	sessionTTL := 120
	return &NotifyConfig{
		SMTPHost:          GetEnv("SMTP_HOST", ""),
		SMTPPort:          GetEnv("SMTP_PORT", "587"),
		SMTPUser:          GetEnv("SMTP_USER", ""),
		SMTPPass:          GetEnv("SMTP_PASS", ""),
		SMTPFrom:          GetEnv("SMTP_FROM", "no-reply@platform.local"),
		MitakeUsername:    GetEnv("MITAKE_USERNAME", ""),
		MitakePassword:    GetEnv("MITAKE_PASSWORD", ""),
		OTPExpirySecs:     otpExpiry,
		KYCSessionTTLMins: sessionTTL,
	}
}

func parseUint64(s string) uint64 {
	v, _ := strconv.ParseUint(s, 10, 64)
	return v
}

func LoadBlockchainConfig() *BlockchainConfig {
	chainID, err := strconv.ParseInt(GetEnv("APP_CHAIN_ID", "11155111"), 10, 64)
	if err != nil {
		chainID = 11155111
	}

	platformFeeBps, err := strconv.Atoi(GetEnv("APP_PLATFORM_FEE_BPS", "500"))
	if err != nil {
		platformFeeBps = 500
	}

	confirmationBlocks, err := strconv.ParseUint(GetEnv("ETH_CONFIRMATION_BLOCKS", "3"), 10, 64)
	if err != nil {
		confirmationBlocks = 3
	}

	return &BlockchainConfig{
		GodModeWalletAddress:    GetEnv("APP_GOD_MODE_WALLET_ADDRESS", ""),
		ChainID:                 chainID,
		RPCURL:                  GetEnv("APP_RPC_URL", ""),
		RewardVaultAddress:      GetEnv("APP_REWARD_VAULT_ADDRESS", ""),
		PlatformFeeBps:          platformFeeBps,
		PlatformTreasuryAddr:    GetEnv("APP_PLATFORM_TREASURY_ADDRESS", ""),
		PlatformOperatorPrivKey: GetEnv("APP_PLATFORM_OPERATOR_PRIVATE_KEY", ""),

		RPCURLFallback:     GetEnv("ETH_RPC_URL_FALLBACK", ""),
		ConfirmationBlocks: confirmationBlocks,

		IdentityNFTAddress:       GetEnv("IDENTITY_NFT_ADDRESS", ""),
		IdentityNFTStartBlock:    parseUint64(GetEnv("IDENTITY_NFT_START_BLOCK", "0")),
		PropertyRegistryAddress:  GetEnv("PROPERTY_REGISTRY_ADDRESS", ""),
		AgencyRegistryAddress:    GetEnv("AGENCY_REGISTRY_ADDRESS", ""),
		ListingStakeVaultAddress: GetEnv("LISTING_STAKE_VAULT_ADDRESS", ""),
		CaseTrackerAddress:       GetEnv("CASE_TRACKER_ADDRESS", ""),
	}
}
