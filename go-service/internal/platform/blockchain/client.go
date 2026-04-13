package blockchain

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/ethclient"
)

// Client 是平台的區塊鏈連線管理器。
//
// 設計原則：
//   - 只讀：不持有私鑰，不送出任何 tx
//   - Failover：主 RPC 斷線時自動切換備用節點
//   - 自動重連：斷線後以指數退避策略重試
type Client struct {
	mu      sync.RWMutex
	eth     *ethclient.Client
	chainID *big.Int

	primaryURL  string
	fallbackURL string
}

// NewClient 建立並連線區塊鏈客戶端。
// primaryURL 為主 RPC，fallbackURL 為備用（可為空）。
func NewClient(primaryURL, fallbackURL string) (*Client, error) {
	if primaryURL == "" {
		return nil, fmt.Errorf("blockchain: primaryURL is required")
	}

	c := &Client{
		primaryURL:  primaryURL,
		fallbackURL: fallbackURL,
	}

	if err := c.connect(); err != nil {
		return nil, err
	}

	return c, nil
}

// Eth 回傳底層的 ethclient.Client（供 indexer 使用）。
// 呼叫者不應持有此 reference 超過單次操作，因重連後 instance 會更換。
func (c *Client) Eth() *ethclient.Client {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.eth
}

// ChainID 回傳已連線鏈的 chain ID。
func (c *Client) ChainID() *big.Int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.chainID
}

// HealthCheck 確認連線是否正常，異常時觸發重連。
func (c *Client) HealthCheck(ctx context.Context) error {
	c.mu.RLock()
	eth := c.eth
	c.mu.RUnlock()

	_, err := eth.BlockNumber(ctx)
	if err != nil {
		log.Printf("[blockchain] health check failed: %v，嘗試重連...", err)
		return c.reconnect(ctx)
	}
	return nil
}

// StartHealthLoop 每 30 秒執行一次健康檢查，在背景持續運行。
// 傳入 ctx 可取消此 loop。
func (c *Client) StartHealthLoop(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				if err := c.HealthCheck(ctx); err != nil {
					log.Printf("[blockchain] reconnect failed: %v", err)
				}
			case <-ctx.Done():
				log.Println("[blockchain] health loop stopped")
				return
			}
		}
	}()
}

// Close 關閉底層連線。
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.eth != nil {
		c.eth.Close()
	}
}

// ─────────────────────────────────────────────
// 內部方法
// ─────────────────────────────────────────────

func (c *Client) connect() error {
	// 先試主 RPC
	if err := c.dialAndVerify(c.primaryURL); err == nil {
		log.Printf("[blockchain] 已連線主 RPC: %s (chainID=%s)", c.primaryURL, c.chainID)
		return nil
	}

	// 主 RPC 失敗，試備用
	if c.fallbackURL != "" {
		log.Printf("[blockchain] 主 RPC 連線失敗，切換至備用 RPC: %s", c.fallbackURL)
		if err := c.dialAndVerify(c.fallbackURL); err == nil {
			log.Printf("[blockchain] 已連線備用 RPC (chainID=%s)", c.chainID)
			return nil
		}
	}

	return fmt.Errorf("blockchain: 所有 RPC 節點均無法連線")
}

func (c *Client) reconnect(ctx context.Context) error {
	const maxRetries = 5
	backoff := 2 * time.Second

	for i := 0; i < maxRetries; i++ {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}

		if err := c.connect(); err == nil {
			log.Printf("[blockchain] 重連成功（第 %d 次嘗試）", i+1)
			return nil
		}

		backoff *= 2 // 指數退避
		log.Printf("[blockchain] 第 %d 次重連失敗，%v 後重試...", i+1, backoff)
	}

	return fmt.Errorf("blockchain: 重連失敗，已達最大重試次數 (%d)", maxRetries)
}

func (c *Client) dialAndVerify(url string) error {
	eth, err := ethclient.Dial(url)
	if err != nil {
		return fmt.Errorf("dial %s: %w", url, err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chainID, err := eth.ChainID(ctx)
	if err != nil {
		eth.Close()
		return fmt.Errorf("get chainID from %s: %w", url, err)
	}

	c.mu.Lock()
	if c.eth != nil {
		c.eth.Close()
	}
	c.eth = eth
	c.chainID = chainID
	c.mu.Unlock()

	return nil
}
