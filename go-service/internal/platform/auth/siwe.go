package auth

import (
	"fmt"
	"go-service/internal/platform/config"
	"time"
)

// 使用 config 注入（不要在這裡用 os.Getenv）
func BuildSIWEMessage(address string, nonce string, cfg *config.SIWEConfig) string {
	issuedAt := time.Now().UTC().Format(time.RFC3339)

	message := fmt.Sprintf(
		"%s wants you to sign in with your Ethereum account:\n%s\n\n%s\n\nURI: %s\nVersion: %s\nChain ID: %s\nNonce: %s\nIssued At: %s",
		cfg.AppDomain,
		address,
		cfg.SIWEStatement,
		cfg.AppURI,
		cfg.SIWEVersion,
		cfg.SIWEChainID,
		nonce,
		issuedAt,
	)

	return message
}
