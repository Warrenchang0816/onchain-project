package listing

import (
	"strings"

	"go-service/internal/db/model"
)

func ShouldBootstrapOwnerDraft(existingOwnerListings int, hasSourceDraft bool) bool {
	return existingOwnerListings == 0 && !hasSourceDraft
}

func IsListingOwner(caller *model.User, ownerUserID int64) bool {
	return caller != nil && caller.ID == ownerUserID
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

func CanSelectListingIntent(l *model.Listing, p *model.Property) bool {
	if l == nil || p == nil {
		return false
	}
	if l.Status != model.ListingStatusDraft {
		return false
	}
	if p.VerificationStatus != model.PropertyVerificationVerified {
		return false
	}
	if p.CompletenessStatus != model.PropertyCompletenessReadyForListing {
		return false
	}
	return strings.TrimSpace(p.DisclosureHash) != ""
}

func IsReadyForPublishWithProperty(l *model.Listing, p *model.Property) bool {
	if !IsReadyForPublish(l) {
		return false
	}
	if p == nil {
		return false
	}
	if p.VerificationStatus != model.PropertyVerificationVerified {
		return false
	}
	if p.CompletenessStatus != model.PropertyCompletenessReadyForListing {
		return false
	}
	return strings.TrimSpace(p.DisclosureHash) != ""
}
