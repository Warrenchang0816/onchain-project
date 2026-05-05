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

type RequirementDistrictRequest struct {
	County   string `json:"county" binding:"required"`
	District string `json:"district" binding:"required"`
	ZipCode  string `json:"zipCode" binding:"required"`
}

type RequirementDistrictResponse struct {
	County   string `json:"county"`
	District string `json:"district"`
	ZipCode  string `json:"zipCode"`
}

type MatchSummaryResponse struct {
	Score          int      `json:"score"`
	Level          string   `json:"level"`
	MatchedReasons []string `json:"matchedReasons"`
	MissingReasons []string `json:"missingReasons"`
}

type TenantRequirementResponse struct {
	ID                         int64                         `json:"id"`
	TargetDistrict             string                        `json:"targetDistrict"`
	Districts                  []RequirementDistrictResponse `json:"districts"`
	BudgetMin                  float64                       `json:"budgetMin"`
	BudgetMax                  float64                       `json:"budgetMax"`
	AreaMinPing                *float64                      `json:"areaMinPing,omitempty"`
	AreaMaxPing                *float64                      `json:"areaMaxPing,omitempty"`
	RoomMin                    int                           `json:"roomMin"`
	BathroomMin                int                           `json:"bathroomMin"`
	LayoutNote                 string                        `json:"layoutNote"`
	MoveInDate                 *string                       `json:"moveInDate,omitempty"`
	MoveInTimeline             *string                       `json:"moveInTimeline,omitempty"`
	MinimumLeaseMonths         int                           `json:"minimumLeaseMonths"`
	PetFriendlyNeeded          bool                          `json:"petFriendlyNeeded"`
	ParkingNeeded              bool                          `json:"parkingNeeded"`
	CanCookNeeded              bool                          `json:"canCookNeeded"`
	CanRegisterHouseholdNeeded bool                          `json:"canRegisterHouseholdNeeded"`
	LifestyleNote              string                        `json:"lifestyleNote"`
	MustHaveNote               string                        `json:"mustHaveNote"`
	Status                     string                        `json:"status"`
	HasAdvancedData            bool                          `json:"hasAdvancedData"`
	OccupationType             *string                       `json:"occupationType,omitempty"`
	IncomeRange                *string                       `json:"incomeRange,omitempty"`
	CreatedAt                  string                        `json:"createdAt"`
	UpdatedAt                  string                        `json:"updatedAt"`
	Match                      *MatchSummaryResponse         `json:"match,omitempty"`
}

type CreateRequirementRequest struct {
	TargetDistrict             string                       `json:"targetDistrict"`
	Districts                  []RequirementDistrictRequest `json:"districts"`
	BudgetMin                  float64                      `json:"budgetMin"`
	BudgetMax                  float64                      `json:"budgetMax"`
	AreaMinPing                *float64                     `json:"areaMinPing,omitempty"`
	AreaMaxPing                *float64                     `json:"areaMaxPing,omitempty"`
	RoomMin                    int                          `json:"roomMin"`
	BathroomMin                int                          `json:"bathroomMin"`
	LayoutNote                 string                       `json:"layoutNote"`
	MoveInDate                 *string                      `json:"moveInDate"`
	MoveInTimeline             string                       `json:"moveInTimeline"`
	MinimumLeaseMonths         int                          `json:"minimumLeaseMonths"`
	PetFriendlyNeeded          bool                         `json:"petFriendlyNeeded"`
	ParkingNeeded              bool                         `json:"parkingNeeded"`
	CanCookNeeded              bool                         `json:"canCookNeeded"`
	CanRegisterHouseholdNeeded bool                         `json:"canRegisterHouseholdNeeded"`
	LifestyleNote              string                       `json:"lifestyleNote"`
	MustHaveNote               string                       `json:"mustHaveNote"`
}

type UpdateRequirementRequest struct {
	TargetDistrict             string                       `json:"targetDistrict"`
	Districts                  []RequirementDistrictRequest `json:"districts"`
	BudgetMin                  float64                      `json:"budgetMin"`
	BudgetMax                  float64                      `json:"budgetMax"`
	AreaMinPing                *float64                     `json:"areaMinPing,omitempty"`
	AreaMaxPing                *float64                     `json:"areaMaxPing,omitempty"`
	RoomMin                    int                          `json:"roomMin"`
	BathroomMin                int                          `json:"bathroomMin"`
	LayoutNote                 string                       `json:"layoutNote"`
	MoveInDate                 *string                      `json:"moveInDate"`
	MoveInTimeline             string                       `json:"moveInTimeline"`
	MinimumLeaseMonths         int                          `json:"minimumLeaseMonths"`
	PetFriendlyNeeded          bool                         `json:"petFriendlyNeeded"`
	ParkingNeeded              bool                         `json:"parkingNeeded"`
	CanCookNeeded              bool                         `json:"canCookNeeded"`
	CanRegisterHouseholdNeeded bool                         `json:"canRegisterHouseholdNeeded"`
	LifestyleNote              string                       `json:"lifestyleNote"`
	MustHaveNote               string                       `json:"mustHaveNote"`
}

type RequirementFilter struct {
	District  string
	Districts []string
	County    string
	Status    string
	Keyword   string
}
