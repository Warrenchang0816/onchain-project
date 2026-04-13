package model

import "time"

type BlockchainLog struct {
	ID              int64
	TaskID          string
	WalletAddress   string
	Action          string
	TxHash          string
	ChainID         int64
	ContractAddress string
	Status          string
	CreatedAt       time.Time
}
