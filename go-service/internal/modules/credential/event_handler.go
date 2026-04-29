package credential

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

type Worker struct {
	contractAddress common.Address
	userRepo        *repository.UserRepository
	credentialRepo  *repository.UserCredentialRepository
	parsedABI       abi.ABI
	checkpoint      *indexer.CheckpointStore
	startBlock      uint64
}

func NewWorker(
	contractAddress string,
	userRepo *repository.UserRepository,
	credentialRepo *repository.UserCredentialRepository,
	checkpoint *indexer.CheckpointStore,
	startBlock uint64,
) (*Worker, error) {
	parsedABI, err := abi.JSON(strings.NewReader(identityNFTCredentialEventsABIJSON))
	if err != nil {
		return nil, fmt.Errorf("credential_worker: parse ABI: %w", err)
	}

	return &Worker{
		contractAddress: common.HexToAddress(contractAddress),
		userRepo:        userRepo,
		credentialRepo:  credentialRepo,
		parsedABI:       parsedABI,
		checkpoint:      checkpoint,
		startBlock:      startBlock,
	}, nil
}

func (w *Worker) ContractName() string    { return "IdentityNFT" }
func (w *Worker) Address() common.Address { return w.contractAddress }
func (w *Worker) StartBlock() uint64      { return w.startBlock }

func (w *Worker) ProcessBlock(ctx context.Context, eth *ethclient.Client, blockNumber uint64) error {
	blockBig := big.NewInt(int64(blockNumber))
	logs, err := eth.FilterLogs(ctx, ethereum.FilterQuery{
		FromBlock: blockBig,
		ToBlock:   blockBig,
		Addresses: []common.Address{w.contractAddress},
	})
	if err != nil {
		return fmt.Errorf("credential_worker: FilterLogs block %d: %w", blockNumber, err)
	}

	mintedEvent, err := w.parsedABI.EventByID(w.parsedABI.Events["CredentialMinted"].ID)
	if err != nil {
		return fmt.Errorf("credential_worker: resolve CredentialMinted event: %w", err)
	}

	for _, vlog := range logs {
		if len(vlog.Topics) < 1 || vlog.Topics[0] != mintedEvent.ID {
			continue
		}

		if len(vlog.Topics) < 3 {
			log.Printf("[credential_worker] unexpected topics length %d in tx %s", len(vlog.Topics), vlog.TxHash.Hex())
			continue
		}

		ownerAddr := common.HexToAddress(vlog.Topics[1].Hex())
		tokenID := new(big.Int).SetBytes(vlog.Topics[2].Bytes()).Int64()

		credentialType, err := TypeForTokenID(tokenID)
		if err != nil {
			log.Printf("[credential_worker] skipping unsupported token id %d in tx %s", tokenID, vlog.TxHash.Hex())
			continue
		}

		user, err := w.userRepo.FindByWallet(ownerAddr.Hex())
		if err != nil {
			return fmt.Errorf("credential_worker: user lookup failed for wallet %s: %w", ownerAddr.Hex(), err)
		}
		if user == nil {
			return fmt.Errorf("credential_worker: user not found for wallet %s", ownerAddr.Hex())
		}

		walletLower := strings.ToLower(ownerAddr.Hex())
		if err := w.credentialRepo.UpsertIssuedCredential(user.ID, credentialType, int32(tokenID), vlog.TxHash.Hex(), walletLower); err != nil {
			return err
		}
		isNew, err := w.checkpoint.MarkProcessed(
			ctx,
			vlog.TxHash.Hex(),
			vlog.Index,
			"IdentityNFT",
			"CredentialMinted",
			blockNumber,
		)
		if err != nil {
			return err
		}
		if !isNew {
			continue
		}

		log.Printf("[credential_worker] credential issued: wallet=%s type=%s tokenID=%d tx=%s",
			walletLower, credentialType, tokenID, vlog.TxHash.Hex())
	}

	return nil
}

const identityNFTCredentialEventsABIJSON = `[
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true,  "internalType": "address", "name": "owner",    "type": "address" },
            { "indexed": true,  "internalType": "uint256", "name": "tokenId",  "type": "uint256" },
            { "indexed": false, "internalType": "uint256", "name": "mintedAt", "type": "uint256" }
        ],
        "name": "CredentialMinted",
        "type": "event"
    }
]`
