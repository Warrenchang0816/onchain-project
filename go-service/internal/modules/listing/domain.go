package listing

import (
	"strings"

	"go-service/internal/db/model"
)

func ShouldBootstrapOwnerDraft(existingOwnerListings int, hasSourceDraft bool) bool {
	return existingOwnerListings == 0 && !hasSourceDraft
}

func ComputeSetupStatus(l *model.Listing) string {
	if l == nil {
		return model.ListingSetupStatusIncomplete
	}
	if strings.TrimSpace(l.Title) == "" || strings.TrimSpace(l.Address) == "" {
		return model.ListingSetupStatusIncomplete
	}
	if l.ListType != model.ListingTypeRent && l.ListType != model.ListingTypeSale {
		return model.ListingSetupStatusIncomplete
	}
	if l.Price <= 0 {
		return model.ListingSetupStatusIncomplete
	}
	if !l.AreaPing.Valid || !l.RoomCount.Valid || !l.BathroomCount.Valid {
		return model.ListingSetupStatusIncomplete
	}
	return model.ListingSetupStatusReady
}

func IsReadyForPublish(l *model.Listing) bool {
	if l == nil {
		return false
	}
	if l.Status != model.ListingStatusDraft {
		return false
	}
	if l.SetupStatus != model.ListingSetupStatusReady {
		return false
	}
	return ComputeSetupStatus(l) == model.ListingSetupStatusReady
}
