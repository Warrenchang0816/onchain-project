package listing

import (
	"database/sql"
	"testing"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/db/repository"
)

type fakeListingStore struct {
	byID               map[int64]*model.Listing
	updatedRentID      int64
	updatedRent        model.ListingRentDetails
	updatedRentListing model.Listing
	updatedRentStatus  string
	updatedSaleID      int64
	updatedSale        model.ListingSaleDetails
	updatedSaleListing model.Listing
	updatedSaleStatus  string
}

func (f *fakeListingStore) FindAll(repository.ListingFilter) ([]*model.Listing, error) {
	return nil, nil
}
func (f *fakeListingStore) FindByID(id int64) (*model.Listing, error) { return f.byID[id], nil }
func (f *fakeListingStore) CountByOwner(int64) (int, error)           { return 0, nil }
func (f *fakeListingStore) FindBySourceCredentialSubmission(int64) (*model.Listing, error) {
	return nil, nil
}
func (f *fakeListingStore) Create(int64, string, string, *string, *string, string, float64, *float64, *int, *int, *int, *int, bool, bool, float64) (int64, error) {
	return 0, nil
}
func (f *fakeListingStore) CreateBootstrapDraft(int64, int64, int64, string) (int64, error) {
	return 0, nil
}
func (f *fakeListingStore) BindProperty(int64, int64) error { return nil }
func (f *fakeListingStore) UpdateIntent(int64, string, string) error {
	return nil
}
func (f *fakeListingStore) UpdateInfo(int64, string, string, *string, *string, string, string, float64, *float64, *int, *int, *int, *int, bool, bool) error {
	return nil
}
func (f *fakeListingStore) UpdateRentDetails(id int64, listing model.Listing, details model.ListingRentDetails, setupStatus string) error {
	f.updatedRentID = id
	f.updatedRent = details
	f.updatedRentListing = listing
	f.updatedRentStatus = setupStatus
	if l := f.byID[id]; l != nil {
		l.Title = listing.Title
		l.Price = listing.Price
		l.RentDetails = &details
		l.SetupStatus = setupStatus
	}
	return nil
}
func (f *fakeListingStore) UpdateSaleDetails(id int64, listing model.Listing, details model.ListingSaleDetails, setupStatus string) error {
	f.updatedSaleID = id
	f.updatedSale = details
	f.updatedSaleListing = listing
	f.updatedSaleStatus = setupStatus
	if l := f.byID[id]; l != nil {
		l.Title = listing.Title
		l.Price = listing.Price
		l.SaleDetails = &details
		l.SetupStatus = setupStatus
	}
	return nil
}
func (f *fakeListingStore) Publish(int64, int) error              { return nil }
func (f *fakeListingStore) SetStatus(int64, string) error         { return nil }
func (f *fakeListingStore) LockForNegotiation(int64, int64) error { return nil }
func (f *fakeListingStore) UnlockNegotiation(int64) error         { return nil }
func (f *fakeListingStore) Close(int64) error                     { return nil }
func (f *fakeListingStore) AttachDetails(*model.Listing) error    { return nil }

type fakeApptStore struct{}

func (f *fakeApptStore) FindByListing(int64) ([]*model.ListingAppointment, error) { return nil, nil }
func (f *fakeApptStore) FindByID(int64) (*model.ListingAppointment, error)        { return nil, nil }
func (f *fakeApptStore) FindByListingAndVisitor(int64, int64) (*model.ListingAppointment, error) {
	return nil, nil
}
func (f *fakeApptStore) NextQueuePosition(int64) (int, error) { return 1, nil }
func (f *fakeApptStore) Create(int64, int64, int, time.Time, *string) (int64, error) {
	return 0, nil
}
func (f *fakeApptStore) Confirm(int64, time.Time) error { return nil }
func (f *fakeApptStore) SetStatus(int64, string) error  { return nil }

type fakeListingUserStore struct {
	byWallet map[string]*model.User
}

func (f *fakeListingUserStore) FindByWallet(wallet string) (*model.User, error) {
	return f.byWallet[wallet], nil
}

func TestUpdateRentDetailsStoresRentDetailsAndMarksReady(t *testing.T) {
	listings := &fakeListingStore{byID: map[int64]*model.Listing{
		11: {
			ID:            11,
			OwnerUserID:   7,
			Status:        model.ListingStatusDraft,
			ListType:      model.ListingTypeRent,
			Title:         "Draft rent",
			Address:       "Taipei Main Road 100",
			Price:         36000,
			AreaPing:      sql.NullFloat64{Float64: 21.5, Valid: true},
			RoomCount:     sql.NullInt64{Int64: 2, Valid: true},
			BathroomCount: sql.NullInt64{Int64: 1, Valid: true},
		},
	}}
	users := &fakeListingUserStore{byWallet: map[string]*model.User{
		"0xowner": {ID: 7, WalletAddress: "0xowner"},
	}}
	svc := NewService(listings, &fakeApptStore{}, users, nil)

	err := svc.UpdateRentDetails(11, "0xowner", UpdateRentDetailsRequest{
		Title:              "Draft rent",
		Address:            "Taipei Main Road 100",
		Price:              36000,
		AreaPing:           floatPtr(21.5),
		RoomCount:          intPtr(2),
		BathroomCount:      intPtr(1),
		MonthlyRent:        36000,
		DepositMonths:      2,
		MinimumLeaseMonths: 12,
	})
	if err != nil {
		t.Fatalf("UpdateRentDetails() error = %v", err)
	}
	if listings.updatedRentID != 11 {
		t.Fatalf("rent details listing id = %d, want 11", listings.updatedRentID)
	}
	if listings.updatedRentStatus != model.ListingSetupStatusReady {
		t.Fatalf("setup status = %s, want %s", listings.updatedRentStatus, model.ListingSetupStatusReady)
	}
}

func TestUpdateSaleDetailsStoresSaleDetailsAndMarksReady(t *testing.T) {
	listings := &fakeListingStore{byID: map[int64]*model.Listing{
		22: {
			ID:            22,
			OwnerUserID:   7,
			Status:        model.ListingStatusDraft,
			ListType:      model.ListingTypeSale,
			Title:         "Draft sale",
			Address:       "Taipei Main Road 100",
			Price:         18800000,
			AreaPing:      sql.NullFloat64{Float64: 32.2, Valid: true},
			RoomCount:     sql.NullInt64{Int64: 3, Valid: true},
			BathroomCount: sql.NullInt64{Int64: 2, Valid: true},
		},
	}}
	users := &fakeListingUserStore{byWallet: map[string]*model.User{
		"0xowner": {ID: 7, WalletAddress: "0xowner"},
	}}
	svc := NewService(listings, &fakeApptStore{}, users, nil)

	err := svc.UpdateSaleDetails(22, "0xowner", UpdateSaleDetailsRequest{
		Title:          "Draft sale",
		Address:        "Taipei Main Road 100",
		Price:          18800000,
		AreaPing:       floatPtr(32.2),
		RoomCount:      intPtr(3),
		BathroomCount:  intPtr(2),
		SaleTotalPrice: 18800000,
	})
	if err != nil {
		t.Fatalf("UpdateSaleDetails() error = %v", err)
	}
	if listings.updatedSaleID != 22 {
		t.Fatalf("sale details listing id = %d, want 22", listings.updatedSaleID)
	}
	if listings.updatedSaleStatus != model.ListingSetupStatusReady {
		t.Fatalf("setup status = %s, want %s", listings.updatedSaleStatus, model.ListingSetupStatusReady)
	}
}

func floatPtr(v float64) *float64 { return &v }

func intPtr(v int) *int { return &v }
