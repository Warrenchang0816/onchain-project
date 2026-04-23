package agent

// AgentListItem is one entry in the public agent list.
type AgentListItem struct {
	WalletAddress string  `json:"walletAddress"`
	DisplayName   *string `json:"displayName,omitempty"`
	ActivatedAt   string  `json:"activatedAt"`
	NFTTokenID    int32   `json:"nftTokenId"`
}

// AgentDetailResponse is the full detail for a single certified agent.
type AgentDetailResponse struct {
	WalletAddress string  `json:"walletAddress"`
	DisplayName   *string `json:"displayName,omitempty"`
	ActivatedAt   string  `json:"activatedAt"`
	NFTTokenID    int32   `json:"nftTokenId"`
	TxHash        string  `json:"txHash"`
}

// AgentListResponse wraps the items slice for the list endpoint.
type AgentListResponse struct {
	Items []AgentListItem `json:"items"`
}
