package user

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"strings"

	"go-service/internal/db/repository"
	"go-service/internal/platform/indexer"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

// IdentityWorker implements indexer.ContractWorker for the IdentityNFT contract.
// It watches for IdentityMinted events and updates the users table accordingly.
type IdentityWorker struct {
	contractAddress common.Address
	userRepo        *repository.UserRepository
	parsedABI       abi.ABI
	checkpoint      *indexer.CheckpointStore
	startBlock      uint64
}

func NewIdentityWorker(
	contractAddress string,
	userRepo *repository.UserRepository,
	checkpoint *indexer.CheckpointStore,
	startBlock uint64,
) (*IdentityWorker, error) {
	parsedABI, err := abi.JSON(strings.NewReader(identityNFTEventsABIJSON))
	if err != nil {
		return nil, fmt.Errorf("identity_worker: parse ABI: %w", err)
	}
	return &IdentityWorker{
		contractAddress: common.HexToAddress(contractAddress),
		userRepo:        userRepo,
		parsedABI:       parsedABI,
		checkpoint:      checkpoint,
		startBlock:      startBlock,
	}, nil
}

func (w *IdentityWorker) ContractName() string        { return "IdentityNFT" }
func (w *IdentityWorker) Address() common.Address     { return w.contractAddress }
func (w *IdentityWorker) StartBlock() uint64          { return w.startBlock }

func (w *IdentityWorker) ProcessBlock(ctx context.Context, eth *ethclient.Client, blockNumber uint64) error {
	blockBig := big.NewInt(int64(blockNumber))
	logs, err := eth.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: blockBig,
		ToBlock:   blockBig,
		Addresses: []common.Address{w.contractAddress},
	})
	if err != nil {
		return fmt.Errorf("identity_worker: FilterLogs block %d: %w", blockNumber, err)
	}

	mintedEvent, err := w.parsedABI.EventByID(w.parsedABI.Events["IdentityMinted"].ID)
	if err != nil {
		return fmt.Errorf("identity_worker: resolve IdentityMinted event: %w", err)
	}

	for _, vlog := range logs {
		if len(vlog.Topics) < 1 || vlog.Topics[0] != mintedEvent.ID {
			continue // not an IdentityMinted event
		}

		isNew, err := w.checkpoint.MarkProcessed(ctx,
			vlog.TxHash.Hex(), vlog.Index,
			"IdentityNFT", "IdentityMinted", blockNumber,
		)
		if err != nil {
			return err
		}
		if !isNew {
			continue // already processed (re-org protection)
		}

		// Topics layout: [eventSig (idx 0), tokenId (idx 1, indexed), owner (idx 2, indexed)]
		if len(vlog.Topics) < 3 {
			log.Printf("[identity_worker] unexpected topics length %d in tx %s", len(vlog.Topics), vlog.TxHash.Hex())
			continue
		}

		tokenID := new(big.Int).SetBytes(vlog.Topics[1].Bytes())
		ownerAddr := common.HexToAddress(vlog.Topics[2].Hex())

		walletLower := strings.ToLower(ownerAddr.Hex())
		if err := w.userRepo.SetKYCVerified(walletLower, tokenID.Int64(), vlog.TxHash.Hex()); err != nil {
			log.Printf("[identity_worker] SetKYCVerified failed wallet=%s: %v", walletLower, err)
			return err
		}

		log.Printf("[identity_worker] KYC verified: wallet=%s tokenID=%s tx=%s",
			walletLower, tokenID.String(), vlog.TxHash.Hex())
	}

	return nil
}

// identityNFTEventsABIJSON contains only the events needed by this worker.
const identityNFTEventsABIJSON = `[
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true,  "internalType": "uint256", "name": "tokenId",     "type": "uint256" },
            { "indexed": true,  "internalType": "address", "name": "owner",       "type": "address" },
            { "indexed": false, "internalType": "string",  "name": "provider",    "type": "string"  },
            { "indexed": false, "internalType": "bytes32", "name": "referenceId", "type": "bytes32" },
            { "indexed": false, "internalType": "uint256", "name": "mintedAt",    "type": "uint256" }
        ],
        "name": "IdentityMinted",
        "type": "event"
    }
]`
