package tenant

import (
	"strings"

	"go-service/internal/db/model"
)

func HasAdvancedData(profile *model.TenantProfile, docs []*model.TenantProfileDocument) bool {
	if profile == nil {
		return false
	}
	if strings.TrimSpace(profile.OccupationType) == "" ||
		strings.TrimSpace(profile.OrgName) == "" ||
		strings.TrimSpace(profile.IncomeRange) == "" {
		return false
	}

	hasDisclosure := profile.HouseholdSize > 0 ||
		strings.TrimSpace(profile.CoResidentNote) != "" ||
		strings.TrimSpace(profile.MoveInTimeline) != "" ||
		strings.TrimSpace(profile.AdditionalNote) != ""
	if !hasDisclosure {
		return false
	}

	for _, doc := range docs {
		if doc.DocType == model.TenantDocTypeIncomeProof ||
			doc.DocType == model.TenantDocTypeHousehold ||
			doc.DocType == model.TenantDocTypeOther {
			return true
		}
	}
	return false
}

func DeriveAdvancedDataStatus(profile *model.TenantProfile, docs []*model.TenantProfileDocument) string {
	if HasAdvancedData(profile, docs) {
		return model.TenantAdvancedDataAdvanced
	}
	return model.TenantAdvancedDataBasic
}
