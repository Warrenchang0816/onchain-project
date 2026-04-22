package user

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"

	"go-service/internal/platform/config"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// IdentityContractService is the interface for Go OPERATOR key interactions with IdentityNFT.
// Mint returns (txHash, tokenID, error). tokenID is parsed from the IdentityMinted event log
// in the confirmed receipt, so SetKYCVerified can be called immediately without waiting for
// the indexer's ConfirmationBlocks window.
//
// MintCredential issues an OWNER / TENANT / AGENT credential after explicit activation.
//
// HasToken queries balanceOf(wallet, tokenID) on-chain.
//
// IsVerified queries balanceOf(wallet, NATURAL_PERSON) on-chain.
// Returns (tokenID=1, nil) if verified; (0, nil) if not; (0, err) on RPC failure.
type IdentityContractService interface {
	Mint(ctx context.Context, to string, provider string, referenceID [32]byte, identityHash [32]byte) (string, int64, error)
	MintCredential(ctx context.Context, to string, tokenID int64) (string, error)
	HasToken(ctx context.Context, walletAddress string, tokenID int64) (bool, error)
	IsVerified(ctx context.Context, walletAddress string) (bool, error)
}

type identityContractService struct {
	client          *ethclient.Client
	contractAddress common.Address
	operatorKey     *ecdsa.PrivateKey
	operatorAddress common.Address
	chainID         *big.Int
	contractABI     abi.ABI
}

// NewIdentityContractService creates the service that calls IdentityNFT via the platform OPERATOR key.
func NewIdentityContractService(cfg *config.BlockchainConfig) (IdentityContractService, error) {
	if cfg.RPCURL == "" {
		return nil, fmt.Errorf("identity_contract: APP_RPC_URL is required")
	}
	if cfg.IdentityNFTAddress == "" {
		return nil, fmt.Errorf("identity_contract: IDENTITY_NFT_ADDRESS is required")
	}
	if cfg.PlatformOperatorPrivKey == "" {
		return nil, fmt.Errorf("identity_contract: APP_PLATFORM_OPERATOR_PRIVATE_KEY is required")
	}

	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		return nil, fmt.Errorf("identity_contract: connect rpc: %w", err)
	}

	privKeyHex := strings.TrimPrefix(cfg.PlatformOperatorPrivKey, "0x")
	privKeyBytes, err := hex.DecodeString(privKeyHex)
	if err != nil {
		return nil, fmt.Errorf("identity_contract: invalid operator private key: %w", err)
	}

	privateKey, err := crypto.ToECDSA(privKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("identity_contract: parse operator private key: %w", err)
	}

	pub, ok := privateKey.Public().(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("identity_contract: cast public key to ECDSA")
	}

	parsedABI, err := abi.JSON(strings.NewReader(identityNFTWriteABIJSON))
	if err != nil {
		return nil, fmt.Errorf("identity_contract: parse ABI: %w", err)
	}

	return &identityContractService{
		client:          client,
		contractAddress: common.HexToAddress(cfg.IdentityNFTAddress),
		operatorKey:     privateKey,
		operatorAddress: crypto.PubkeyToAddress(*pub),
		chainID:         big.NewInt(cfg.ChainID),
		contractABI:     parsedABI,
	}, nil
}

func (s *identityContractService) Mint(ctx context.Context, to string, provider string, referenceID [32]byte, identityHash [32]byte) (string, int64, error) {
	data, err := s.contractABI.Pack("mint",
		common.HexToAddress(to),
		provider,
		referenceID,
		identityHash,
	)
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: pack mint: %w", err)
	}
	return s.sendMintTransaction(ctx, data)
}

func (s *identityContractService) MintCredential(ctx context.Context, to string, tokenID int64) (string, error) {
	data, err := s.contractABI.Pack("mintCredential", common.HexToAddress(to), big.NewInt(tokenID))
	if err != nil {
		return "", fmt.Errorf("identity_contract: pack mintCredential: %w", err)
	}

	txHash, _, err := s.sendMintTransaction(ctx, data)
	return txHash, err
}

// sendMintTransaction broadcasts a signed tx, waits for the receipt, then extracts
// the tokenID from the IdentityMinted event log so the caller can update the DB
// immediately — without relying on the indexer's ConfirmationBlocks window.
// Transactions that do not emit IdentityMinted, such as mintCredential, return tokenID = 0.
func (s *identityContractService) sendMintTransaction(ctx context.Context, data []byte) (string, int64, error) {
	nonce, err := s.client.PendingNonceAt(ctx, s.operatorAddress)
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: get nonce: %w", err)
	}

	gasTipCap, err := s.client.SuggestGasTipCap(ctx)
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: gas tip cap: %w", err)
	}

	header, err := s.client.HeaderByNumber(ctx, nil)
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: latest header: %w", err)
	}

	gasFeeCap := new(big.Int).Add(
		new(big.Int).Mul(header.BaseFee, big.NewInt(2)),
		gasTipCap,
	)

	gasLimit, err := s.client.EstimateGas(ctx, ethereum.CallMsg{
		From:      s.operatorAddress,
		To:        &s.contractAddress,
		GasFeeCap: gasFeeCap,
		GasTipCap: gasTipCap,
		Value:     big.NewInt(0),
		Data:      data,
	})
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: estimate gas: %w", err)
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
		return "", 0, fmt.Errorf("identity_contract: sign tx: %w", err)
	}

	if err := s.client.SendTransaction(ctx, signedTx); err != nil {
		return "", 0, fmt.Errorf("identity_contract: send tx: %w", err)
	}

	receipt, err := bind.WaitMined(ctx, s.client, signedTx)
	if err != nil {
		return "", 0, fmt.Errorf("identity_contract: wait mined: %w", err)
	}

	if receipt.Status != types.ReceiptStatusSuccessful {
		return "", 0, fmt.Errorf("identity_contract: transaction reverted: %s", signedTx.Hash().Hex())
	}

	// Extract tokenID from the IdentityMinted event in the receipt.
	// Solidity event: IdentityMinted(address indexed owner, uint256 indexed tokenId, ...)
	// Topics layout: [eventSig(0), owner(1, indexed address), tokenId(2, indexed uint256)]
	eventSig := crypto.Keccak256Hash([]byte("IdentityMinted(address,uint256,string,bytes32,uint256)"))
	var tokenID int64
	for _, vlog := range receipt.Logs {
		if vlog.Address != s.contractAddress {
			continue
		}
		if len(vlog.Topics) < 3 || vlog.Topics[0] != eventSig {
			continue
		}
		tokenID = new(big.Int).SetBytes(vlog.Topics[2].Bytes()).Int64()
		break
	}

	return signedTx.Hash().Hex(), tokenID, nil
}

func (s *identityContractService) HasToken(ctx context.Context, walletAddress string, tokenID int64) (bool, error) {
	viewABI, err := abi.JSON(strings.NewReader(identityNFTViewABIJSON))
	if err != nil {
		return false, fmt.Errorf("identity_contract: parse view ABI: %w", err)
	}
	data, err := viewABI.Pack("balanceOf", common.HexToAddress(walletAddress), big.NewInt(tokenID))
	if err != nil {
		return false, fmt.Errorf("identity_contract: pack balanceOf: %w", err)
	}
	result, err := s.client.CallContract(ctx, ethereum.CallMsg{
		To:   &s.contractAddress,
		Data: data,
	}, nil)
	if err != nil {
		return false, fmt.Errorf("identity_contract: call balanceOf: %w", err)
	}
	outputs, err := viewABI.Unpack("balanceOf", result)
	if err != nil || len(outputs) == 0 {
		return false, fmt.Errorf("identity_contract: unpack balanceOf: %w", err)
	}
	balance, ok := outputs[0].(*big.Int)
	if !ok {
		return false, fmt.Errorf("identity_contract: unexpected balanceOf type")
	}
	return balance.Sign() > 0, nil
}

// IsVerified calls balanceOf(wallet, 1) on-chain to check whether the wallet
// already holds a NATURAL_PERSON SBT (tokenId = 1).
// Returns (true, nil) if balance > 0, (false, nil) if not, (false, err) on RPC failure.
func (s *identityContractService) IsVerified(ctx context.Context, walletAddress string) (bool, error) {
	return s.HasToken(ctx, walletAddress, 1)
}

const identityNFTWriteABIJSON = `[
    {
        "inputs": [
            { "internalType": "address", "name": "to",          "type": "address"  },
            { "internalType": "string",  "name": "provider",    "type": "string"   },
            { "internalType": "bytes32", "name": "referenceId", "type": "bytes32"  },
            { "internalType": "bytes32", "name": "identityHash","type": "bytes32"  }
        ],
        "name": "mint",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "to",      "type": "address"  },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "mintCredential",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]`

const identityNFTViewABIJSON = `[
    {
        "inputs": [
            { "internalType": "address", "name": "account", "type": "address" },
            { "internalType": "uint256", "name": "id",      "type": "uint256" }
        ],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
]`
