package agent

// AgentListFilter holds optional filters for the public agent list.
type AgentListFilter struct {
	ServiceArea     string
	ProfileComplete *bool
}

// AgentListItem is one entry in the public agent list.
type AgentListItem struct {
	WalletAddress     string   `json:"walletAddress"`
	DisplayName       *string  `json:"displayName,omitempty"`
	ActivatedAt       string   `json:"activatedAt"`
	NFTTokenID        int32    `json:"nftTokenId"`
	Headline          *string  `json:"headline,omitempty"`
	ServiceAreas      []string `json:"serviceAreas"`
	IsProfileComplete bool     `json:"isProfileComplete"`
}

// AgentDetailResponse is the full detail for a single certified agent.
type AgentDetailResponse struct {
	WalletAddress     string   `json:"walletAddress"`
	DisplayName       *string  `json:"displayName,omitempty"`
	ActivatedAt       string   `json:"activatedAt"`
	NFTTokenID        int32    `json:"nftTokenId"`
	TxHash            string   `json:"txHash"`
	Headline          *string  `json:"headline,omitempty"`
	Bio               *string  `json:"bio,omitempty"`
	ServiceAreas      []string `json:"serviceAreas"`
	LicenseNote       *string  `json:"licenseNote,omitempty"`
	IsProfileComplete bool     `json:"isProfileComplete"`
}

// AgentListResponse wraps the items slice for the list endpoint.
type AgentListResponse struct {
	Items []AgentListItem `json:"items"`
}

// UpsertMyAgentProfileRequest is the body for PUT /api/agents/me/profile.
type UpsertMyAgentProfileRequest struct {
	Headline           string   `json:"headline"`
	Bio                string   `json:"bio"`
	ServiceAreas       []string `json:"serviceAreas"`
	LicenseNote        string   `json:"licenseNote"`
	ContactPreferences string   `json:"contactPreferences"`
}
