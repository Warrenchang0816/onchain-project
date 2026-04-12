package service

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"go-service/internal/config"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

type TaskRewardVaultService interface {
	AssignWorker(ctx context.Context, taskID string, worker string) (string, error)
	ApproveTask(ctx context.Context, taskID string) (string, error)
}

type taskRewardVaultService struct {
	client          *ethclient.Client
	contractAddress common.Address
	operatorKey     *ecdsa.PrivateKey
	operatorAddress common.Address
	chainID         *big.Int
	contractABI     abi.ABI
}

func NewTaskRewardVaultService() (TaskRewardVaultService, error) {
	cfg := config.LoadBlockchainConfig()

	if cfg.RPCURL == "" {
		return nil, fmt.Errorf("APP_RPC_URL is required")
	}

	if cfg.RewardVaultAddress == "" {
		return nil, fmt.Errorf("APP_REWARD_VAULT_ADDRESS is required")
	}

	if cfg.PlatformOperatorPrivKey == "" {
		return nil, fmt.Errorf("APP_PLATFORM_OPERATOR_PRIVATE_KEY is required")
	}

	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect rpc: %w", err)
	}

	privateKeyHex := strings.TrimPrefix(cfg.PlatformOperatorPrivKey, "0x")
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		return nil, fmt.Errorf("invalid operator private key: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse operator private key: %w", err)
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("failed to cast public key to ECDSA")
	}

	parsedABI, err := abi.JSON(strings.NewReader(taskRewardVaultABIJSON))
	if err != nil {
		return nil, fmt.Errorf("failed to parse vault abi: %w", err)
	}

	return &taskRewardVaultService{
		client:          client,
		contractAddress: common.HexToAddress(cfg.RewardVaultAddress),
		operatorKey:     privateKey,
		operatorAddress: crypto.PubkeyToAddress(*publicKeyECDSA),
		chainID:         big.NewInt(cfg.ChainID),
		contractABI:     parsedABI,
	}, nil
}

func (s *taskRewardVaultService) AssignWorker(ctx context.Context, taskID string, worker string) (string, error) {
	workerAddress := common.HexToAddress(worker)

	methodData, err := s.contractABI.Pack(
		"assignWorker",
		ToTaskBytes32(taskID),
		workerAddress,
	)
	if err != nil {
		return "", fmt.Errorf("failed to pack assignWorker call: %w", err)
	}

	txHash, err := s.sendTransaction(ctx, methodData)
	if err != nil {
		return "", err
	}

	return txHash, nil
}

func (s *taskRewardVaultService) ApproveTask(ctx context.Context, taskID string) (string, error) {
	methodData, err := s.contractABI.Pack(
		"approveTask",
		ToTaskBytes32(taskID),
	)
	if err != nil {
		return "", fmt.Errorf("failed to pack approveTask call: %w", err)
	}

	txHash, err := s.sendTransaction(ctx, methodData)
	if err != nil {
		return "", err
	}

	return txHash, nil
}

func (s *taskRewardVaultService) sendTransaction(ctx context.Context, data []byte) (string, error) {
	nonce, err := s.client.PendingNonceAt(ctx, s.operatorAddress)
	if err != nil {
		return "", fmt.Errorf("failed to get nonce: %w", err)
	}

	gasTipCap, err := s.client.SuggestGasTipCap(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get gas tip cap: %w", err)
	}

	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("failed to get latest header: %w", err)
	}

	gasFeeCap := new(big.Int).Add(
		new(big.Int).Mul(header.BaseFee, big.NewInt(2)),
		gasTipCap,
	)

	callMsg := ethereum.CallMsg{
		From:      s.operatorAddress,
		To:        &s.contractAddress,
		GasFeeCap: gasFeeCap,
		GasTipCap: gasTipCap,
		Value:     big.NewInt(0),
		Data:      data,
	}

	gasLimit, err := s.client.EstimateGas(ctx, callMsg)
	if err != nil {
		return "", fmt.Errorf("failed to estimate gas: %w", err)
	}

	tx := types.NewTx(&types.DynamicFeeTx{
		ChainID:   s.chainID,
		Nonce:     nonce,
		GasTipCap: gasTipCap,
		GasFeeCap: gasFeeCap,
		Gas:       gasLimit,
		To:        &s.contractAddress,
		Value:     big.NewInt(0),
		Data:      data,
	})

	signedTx, err := types.SignTx(tx, types.NewLondonSigner(s.chainID), s.operatorKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign tx: %w", err)
	}

	if err := s.client.SendTransaction(ctx, signedTx); err != nil {
		return "", fmt.Errorf("failed to send tx: %w", err)
	}

	receipt, err := bind.WaitMined(ctx, s.client, signedTx)
	if err != nil {
		return "", fmt.Errorf("failed waiting tx mined: %w", err)
	}

	if receipt.Status != types.ReceiptStatusSuccessful {
		return "", fmt.Errorf("transaction reverted: %s", signedTx.Hash().Hex())
	}

	return signedTx.Hash().Hex(), nil
}

func ToTaskBytes32(taskID string) [32]byte {
	var result [32]byte
	hash := crypto.Keccak256([]byte(taskID))
	copy(result[:], hash)
	return result
}

const taskRewardVaultABIJSON = `[
    {
        "inputs": [
            { "internalType": "bytes32", "name": "taskId", "type": "bytes32" },
            { "internalType": "address", "name": "worker", "type": "address" }
        ],
        "name": "assignWorker",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "bytes32", "name": "taskId", "type": "bytes32" }
        ],
        "name": "approveTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]`
