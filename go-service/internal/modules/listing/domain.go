package listing

import (
	"strings"

	"go-service/internal/db/model"
)

func ShouldBootstrapOwnerDraft(existingOwnerListings int, hasSourceDraft bool) bool {
	return existingOwnerListings == 0 && !hasSourceDraft
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
	if strings.TrimSpace(l.Title) == "" || strings.TrimSpace(l.Address) == "" {
		return false
	}
	if l.ListType != model.ListingTypeRent && l.ListType != model.ListingTypeSale {
		return false
	}
	if l.Price <= 0 {
		return false
	}
	if !l.AreaPing.Valid || !l.RoomCount.Valid || !l.BathroomCount.Valid {
		return false
	}
	return true
}
