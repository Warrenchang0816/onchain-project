package tenant

import (
	"fmt"
	"strings"

	"go-service/internal/db/model"
)

const (
	MatchLevelGood    = "GOOD"
	MatchLevelPartial = "PARTIAL"
	MatchLevelLow     = "LOW"
)

type RentalMatchRequirement struct {
	DistrictTokens             []string
	BudgetMin                  float64
	BudgetMax                  float64
	AreaMinPing                float64
	AreaMaxPing                float64
	RoomMin                    int
	BathroomMin                int
	PetFriendlyNeeded          bool
	ParkingNeeded              bool
	CanCookNeeded              bool
	CanRegisterHouseholdNeeded bool
	MinimumLeaseMonths         int
}

type RentalMatchListing struct {
	DistrictToken        string
	MonthlyRent          float64
	AreaPing             float64
	RoomCount            int
	BathroomCount        int
	PetAllowed           bool
	ParkingIncluded      bool
	CanCook              bool
	CanRegisterHousehold bool
	MinimumLeaseMonths   int
}

type MatchSummary struct {
	Score          int
	Level          string
	MatchedReasons []string
	MissingReasons []string
}

func ScoreRentalMatch(req RentalMatchRequirement, listing RentalMatchListing) MatchSummary {
	score := 0
	matched := []string{}
	missing := []string{}
	requiredMiss := false

	addMatch := func(points int, reason string) {
		score += points
		matched = append(matched, reason)
	}
	addMiss := func(reason string, required bool) {
		missing = append(missing, reason)
		if required {
			requiredMiss = true
		}
	}

	if containsDistrictToken(req.DistrictTokens, listing.DistrictToken) {
		addMatch(30, "地區符合")
	} else {
		addMiss("地區不在需求範圍", true)
	}

	if withinBudget(req.BudgetMin, req.BudgetMax, listing.MonthlyRent) {
		addMatch(20, "租金符合預算")
	} else {
		addMiss("租金不符合預算", false)
	}

	if withinArea(req.AreaMinPing, req.AreaMaxPing, listing.AreaPing) {
		addMatch(10, "坪數符合")
	} else {
		addMiss("坪數不符合", false)
	}

	if req.RoomMin <= 0 || listing.RoomCount >= req.RoomMin {
		addMatch(10, "房數符合")
	} else {
		addMiss("房數不足", false)
	}

	if req.BathroomMin <= 0 || listing.BathroomCount >= req.BathroomMin {
		addMatch(5, "衛浴數符合")
	} else {
		addMiss("衛浴數不足", false)
	}

	if matchRequiredBool(req.PetFriendlyNeeded, listing.PetAllowed) {
		if req.PetFriendlyNeeded {
			addMatch(5, "可寵物")
		}
	} else {
		addMiss("不符合寵物需求", true)
	}

	if matchRequiredBool(req.ParkingNeeded, listing.ParkingIncluded) {
		if req.ParkingNeeded {
			addMatch(5, "車位符合")
		}
	} else {
		addMiss("不符合車位需求", true)
	}

	if matchRequiredBool(req.CanCookNeeded, listing.CanCook) {
		if req.CanCookNeeded {
			addMatch(5, "可開伙")
		}
	} else {
		addMiss("不可開伙", true)
	}

	if matchRequiredBool(req.CanRegisterHouseholdNeeded, listing.CanRegisterHousehold) {
		if req.CanRegisterHouseholdNeeded {
			addMatch(5, "可設籍")
		}
	} else {
		addMiss("不可設籍", true)
	}

	if req.MinimumLeaseMonths <= 0 || listing.MinimumLeaseMonths <= 0 || listing.MinimumLeaseMonths <= req.MinimumLeaseMonths {
		addMatch(5, "租期符合")
	} else {
		addMiss("最短租期過長", false)
	}

	level := MatchLevelLow
	if !requiredMiss && score >= 80 {
		level = MatchLevelGood
	} else if !requiredMiss && score >= 50 {
		level = MatchLevelPartial
	}

	return MatchSummary{
		Score:          score,
		Level:          level,
		MatchedReasons: matched,
		MissingReasons: missing,
	}
}

func containsDistrictToken(tokens []string, token string) bool {
	if len(tokens) == 0 || strings.TrimSpace(token) == "" {
		return false
	}
	for _, candidate := range tokens {
		if strings.TrimSpace(candidate) == strings.TrimSpace(token) {
			return true
		}
	}
	return false
}

func withinBudget(min, max, rent float64) bool {
	if rent <= 0 {
		return false
	}
	if min > 0 && rent < min {
		return false
	}
	if max > 0 && rent > max {
		return false
	}
	return true
}

func withinArea(min, max, area float64) bool {
	if min <= 0 && max <= 0 {
		return true
	}
	if area <= 0 {
		return false
	}
	if min > 0 && area < min {
		return false
	}
	if max > 0 && area > max {
		return false
	}
	return true
}

func matchRequiredBool(required, provided bool) bool {
	return !required || provided
}

func RequirementDistrictToken(county, district, zipCode string) string {
	return strings.TrimSpace(county) + ":" + strings.TrimSpace(district) + ":" + strings.TrimSpace(zipCode)
}

func RequirementDistrictSummary(districts []*model.TenantRequirementDistrict) string {
	if len(districts) == 0 {
		return ""
	}
	byCounty := map[string]int{}
	for _, d := range districts {
		if strings.TrimSpace(d.County) == "" || strings.TrimSpace(d.District) == "" {
			continue
		}
		byCounty[d.County]++
	}
	if len(byCounty) == 0 {
		return ""
	}
	if len(byCounty) == 1 && len(districts) == 1 {
		return districts[0].County + " " + districts[0].District
	}
	if len(byCounty) == 1 {
		for county, count := range byCounty {
			return fmt.Sprintf("%s %d districts", county, count)
		}
	}
	return fmt.Sprintf("%d counties %d districts", len(byCounty), len(districts))
}

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
