package property

import (
	"database/sql"
	"encoding/json"
	"errors"
	"testing"

	"go-service/internal/db/model"
)

type fakePropertyRepo struct {
	byID     map[int64]*model.Property
	bySource map[int64]*model.Property
	byOwner  map[int64][]*model.Property

	updatedID       int64
	updatedSnapshot BuiltDisclosureSnapshot
	markedReadyID   int64
}

func (f *fakePropertyRepo) FindBySourceCredentialSubmission(submissionID int64) (*model.Property, error) {
	return f.bySource[submissionID], nil
}

func (f *fakePropertyRepo) FindByID(id int64) (*model.Property, error) {
	return f.byID[id], nil
}

func (f *fakePropertyRepo) ListByOwnerUserID(ownerUserID int64) ([]*model.Property, error) {
	return f.byOwner[ownerUserID], nil
}

func (f *fakePropertyRepo) CreateDraftFromOwnerCredential(ownerUserID, submissionID int64, built BuiltPropertyDraft) (int64, error) {
	return 99, nil
}

func (f *fakePropertyRepo) UpdateDisclosure(id int64, built BuiltDisclosureSnapshot) error {
	f.updatedID = id
	f.updatedSnapshot = built
	if p := f.byID[id]; p != nil {
		p.Address = built.Address
		p.DeedNo = built.DeedNo
		p.DeedHash = built.DeedHash
		p.PropertyStatementJSON = built.PropertyStatementJSON
		p.WarrantyAnswersJSON = built.WarrantyAnswersJSON
		p.DisclosureSnapshotJSON = built.DisclosureSnapshotJSON
		p.DisclosureHash = built.DisclosureHash
		p.CompletenessStatus = model.PropertyCompletenessSnapshotReady
	}
	return nil
}

func (f *fakePropertyRepo) MarkReadyForListing(id int64) error {
	f.markedReadyID = id
	if p := f.byID[id]; p != nil {
		p.VerificationStatus = model.PropertyVerificationVerified
		p.CompletenessStatus = model.PropertyCompletenessReadyForListing
	}
	return nil
}

type fakeUserRepo struct {
	byWallet map[string]*model.User
}

func (f *fakeUserRepo) FindByWallet(wallet string) (*model.User, error) {
	return f.byWallet[wallet], nil
}

func TestListMineReturnsCallerProperties(t *testing.T) {
	repo := &fakePropertyRepo{byOwner: map[int64][]*model.Property{
		7: {
			{ID: 11, OwnerUserID: 7, Address: "Taipei A"},
			{ID: 12, OwnerUserID: 7, Address: "Taipei B"},
		},
	}}
	users := &fakeUserRepo{byWallet: map[string]*model.User{
		"0xowner": {ID: 7, WalletAddress: "0xowner"},
	}}
	svc := NewService(repo, users)

	got, err := svc.ListMine("0xowner")
	if err != nil {
		t.Fatalf("ListMine() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("ListMine() length = %d, want 2", len(got))
	}
	if got[0].OwnerUserID != 7 || got[1].OwnerUserID != 7 {
		t.Fatalf("ListMine() returned non-owner properties: %#v", got)
	}
}

func TestUpdateDisclosureForOwnerPreservesStoredOwnerAndSource(t *testing.T) {
	repo := &fakePropertyRepo{byID: map[int64]*model.Property{
		11: {
			ID:                           11,
			OwnerUserID:                  7,
			SourceCredentialSubmissionID: sql.NullInt64{Int64: 42, Valid: true},
		},
	}}
	users := &fakeUserRepo{byWallet: map[string]*model.User{
		"0xowner": {ID: 7, WalletAddress: "0xowner"},
	}}
	svc := NewService(repo, users)

	err := svc.UpdateDisclosureForOwner(11, "0xowner", DisclosureInput{
		OwnerUserID:                  999,
		SourceCredentialSubmissionID: 999,
		PropertyAddress:              "Taipei Main Road 100",
		OwnershipDocNo:               "A-123",
		Statement: PropertyStatement{
			BuildingType:   "Apartment",
			RegisteredPing: 28.5,
			Floor:          5,
			TotalFloors:    7,
		},
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: WarrantyAnswerNo},
			{Code: WarrantyWaterLeak, Answer: WarrantyAnswerNo},
		},
	})
	if err != nil {
		t.Fatalf("UpdateDisclosureForOwner() error = %v", err)
	}
	var snapshot DisclosureSnapshot
	if err := json.Unmarshal(repo.updatedSnapshot.DisclosureSnapshotJSON, &snapshot); err != nil {
		t.Fatalf("snapshot unmarshal: %v", err)
	}
	if snapshot.OwnerUserID != 7 {
		t.Fatalf("snapshot owner = %d, want 7", snapshot.OwnerUserID)
	}
	if snapshot.SourceCredentialSubmissionID != 42 {
		t.Fatalf("snapshot source = %d, want 42", snapshot.SourceCredentialSubmissionID)
	}
}

func TestConfirmDisclosureForOwnerRejectsNonOwner(t *testing.T) {
	repo := &fakePropertyRepo{byID: map[int64]*model.Property{
		11: {
			ID:                     11,
			OwnerUserID:            7,
			DisclosureSnapshotJSON: []byte(`{"version":1}`),
			DisclosureHash:         "abc123",
		},
	}}
	users := &fakeUserRepo{byWallet: map[string]*model.User{
		"0xother": {ID: 8, WalletAddress: "0xother"},
	}}
	svc := NewService(repo, users)

	err := svc.ConfirmDisclosureForOwner(11, "0xother")
	if !errors.Is(err, ErrPropertyForbidden) {
		t.Fatalf("ConfirmDisclosureForOwner() error = %v, want %v", err, ErrPropertyForbidden)
	}
	if repo.markedReadyID != 0 {
		t.Fatalf("marked ready id = %d, want 0", repo.markedReadyID)
	}
}

func TestUpdateDisclosureStoresDeterministicSnapshot(t *testing.T) {
	repo := &fakePropertyRepo{byID: map[int64]*model.Property{
		11: {ID: 11, OwnerUserID: 7},
	}}
	svc := NewService(repo)

	err := svc.UpdateDisclosure(11, DisclosureInput{
		OwnerUserID:                  7,
		SourceCredentialSubmissionID: 42,
		PropertyAddress:              " 台北市信義區松仁路 100 號 ",
		OwnershipDocNo:               " A-123 ",
		Statement: PropertyStatement{
			BuildingType:   "住宅",
			RegisteredPing: 28.5,
			Floor:          5,
			TotalFloors:    7,
		},
		Warranties: []WarrantyAnswer{
			{Code: WarrantySeawaterConcrete, Answer: WarrantyAnswerNo},
			{Code: WarrantyWaterLeak, Answer: WarrantyAnswerUnknown, Note: "待屋主補充佐證"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateDisclosure() error = %v", err)
	}
	if repo.updatedID != 11 {
		t.Fatalf("updated id = %d, want 11", repo.updatedID)
	}
	if repo.updatedSnapshot.Address != "台北市信義區松仁路 100 號" {
		t.Fatalf("snapshot address = %q", repo.updatedSnapshot.Address)
	}
	if repo.updatedSnapshot.DisclosureHash == "" {
		t.Fatal("expected disclosure hash to be stored")
	}
	if len(repo.byID[11].PropertyStatementJSON) == 0 {
		t.Fatal("expected property statement JSON to be stored")
	}
	if len(repo.byID[11].WarrantyAnswersJSON) == 0 {
		t.Fatal("expected warranty answers JSON to be stored")
	}
	if repo.byID[11].CompletenessStatus != model.PropertyCompletenessSnapshotReady {
		t.Fatalf("completeness = %s, want %s", repo.byID[11].CompletenessStatus, model.PropertyCompletenessSnapshotReady)
	}
}

func TestConfirmDisclosureRequiresSnapshot(t *testing.T) {
	repo := &fakePropertyRepo{byID: map[int64]*model.Property{
		11: {
			ID:                 11,
			OwnerUserID:        7,
			CompletenessStatus: model.PropertyCompletenessDisclosureRequired,
		},
	}}
	svc := NewService(repo)

	err := svc.ConfirmDisclosure(11)
	if !errors.Is(err, ErrDisclosureSnapshotRequired) {
		t.Fatalf("ConfirmDisclosure() error = %v, want %v", err, ErrDisclosureSnapshotRequired)
	}
}

func TestConfirmDisclosureMarksReadyForListing(t *testing.T) {
	repo := &fakePropertyRepo{byID: map[int64]*model.Property{
		11: {
			ID:                           11,
			OwnerUserID:                  7,
			SourceCredentialSubmissionID: sql.NullInt64{Int64: 42, Valid: true},
			DisclosureSnapshotJSON:       []byte(`{"version":1}`),
			DisclosureHash:               "abc123",
			VerificationStatus:           model.PropertyVerificationDraft,
			CompletenessStatus:           model.PropertyCompletenessSnapshotReady,
		},
	}}
	svc := NewService(repo)

	if err := svc.ConfirmDisclosure(11); err != nil {
		t.Fatalf("ConfirmDisclosure() error = %v", err)
	}
	if repo.markedReadyID != 11 {
		t.Fatalf("marked ready id = %d, want 11", repo.markedReadyID)
	}
	if repo.byID[11].VerificationStatus != model.PropertyVerificationVerified {
		t.Fatalf("verification = %s, want %s", repo.byID[11].VerificationStatus, model.PropertyVerificationVerified)
	}
	if repo.byID[11].CompletenessStatus != model.PropertyCompletenessReadyForListing {
		t.Fatalf("completeness = %s, want %s", repo.byID[11].CompletenessStatus, model.PropertyCompletenessReadyForListing)
	}
}
