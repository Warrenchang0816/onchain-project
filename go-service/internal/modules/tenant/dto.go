package tenant

type TenantProfileDocumentItem struct {
	ID      int64  `json:"id"`
	DocType string `json:"docType"`
}

type TenantProfileResponse struct {
	OccupationType     string                      `json:"occupationType"`
	OrgName            string                      `json:"orgName"`
	IncomeRange        string                      `json:"incomeRange"`
	HouseholdSize      int                         `json:"householdSize"`
	CoResidentNote     string                      `json:"coResidentNote"`
	MoveInTimeline     string                      `json:"moveInTimeline"`
	AdditionalNote     string                      `json:"additionalNote"`
	AdvancedDataStatus string                      `json:"advancedDataStatus"`
	Documents          []TenantProfileDocumentItem `json:"documents"`
}

type UpsertTenantProfileRequest struct {
	OccupationType string `json:"occupationType" binding:"required"`
	OrgName        string `json:"orgName" binding:"required"`
	IncomeRange    string `json:"incomeRange" binding:"required"`
	HouseholdSize  int    `json:"householdSize"`
	CoResidentNote string `json:"coResidentNote"`
	MoveInTimeline string `json:"moveInTimeline"`
	AdditionalNote string `json:"additionalNote"`
}

type TenantRequirementResponse struct {
	ID                int64   `json:"id"`
	TargetDistrict    string  `json:"targetDistrict"`
	BudgetMin         float64 `json:"budgetMin"`
	BudgetMax         float64 `json:"budgetMax"`
	LayoutNote        string  `json:"layoutNote"`
	MoveInDate        *string `json:"moveInDate,omitempty"`
	PetFriendlyNeeded bool    `json:"petFriendlyNeeded"`
	ParkingNeeded     bool    `json:"parkingNeeded"`
	Status            string  `json:"status"`
	HasAdvancedData   bool    `json:"hasAdvancedData"`
	OccupationType    *string `json:"occupationType,omitempty"`
	IncomeRange       *string `json:"incomeRange,omitempty"`
	MoveInTimeline    *string `json:"moveInTimeline,omitempty"`
	CreatedAt         string  `json:"createdAt"`
	UpdatedAt         string  `json:"updatedAt"`
}

type CreateRequirementRequest struct {
	TargetDistrict    string  `json:"targetDistrict" binding:"required"`
	BudgetMin         float64 `json:"budgetMin"`
	BudgetMax         float64 `json:"budgetMax"`
	LayoutNote        string  `json:"layoutNote"`
	MoveInDate        *string `json:"moveInDate"`
	PetFriendlyNeeded bool    `json:"petFriendlyNeeded"`
	ParkingNeeded     bool    `json:"parkingNeeded"`
}

type UpdateRequirementRequest struct {
	TargetDistrict    string  `json:"targetDistrict" binding:"required"`
	BudgetMin         float64 `json:"budgetMin"`
	BudgetMax         float64 `json:"budgetMax"`
	LayoutNote        string  `json:"layoutNote"`
	MoveInDate        *string `json:"moveInDate"`
	PetFriendlyNeeded bool    `json:"petFriendlyNeeded"`
	ParkingNeeded     bool    `json:"parkingNeeded"`
}

type RequirementFilter struct {
	District string
	Status   string
}
