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
		SIWEStatement:     GetEnv("SIWE_STATEMENT", "Sign in to On-chain Task Tracker."),
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
	PropertyRegistryAddress  string
	AgencyRegistryAddress    string
	ListingStakeVaultAddress string
	CaseTrackerAddress       string
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
		PropertyRegistryAddress:  GetEnv("PROPERTY_REGISTRY_ADDRESS", ""),
		AgencyRegistryAddress:    GetEnv("AGENCY_REGISTRY_ADDRESS", ""),
		ListingStakeVaultAddress: GetEnv("LISTING_STAKE_VAULT_ADDRESS", ""),
		CaseTrackerAddress:       GetEnv("CASE_TRACKER_ADDRESS", ""),
	}
}
