package rental_listing

import (
	"errors"
	"testing"

	"go-service/internal/db/model"
)

func TestApplyRentalUpdate_FieldsAreApplied(t *testing.T) {
	trueVal := true
	falseVal := false
	rent := 30000.0
	rl := &model.RentalListing{}
	req := UpdateRentalListingRequest{
		MonthlyRent: &rent,
		AllowPets:   &trueVal,
		AllowCooking: &falseVal,
	}
	applyRentalUpdate(rl, req)
	if rl.MonthlyRent != 30000 {
		t.Errorf("expected MonthlyRent 30000, got %v", rl.MonthlyRent)
	}
	if !rl.AllowPets {
		t.Error("expected AllowPets true")
	}
	if rl.AllowCooking {
		t.Error("expected AllowCooking false")
	}
}

func TestApplyRentalUpdate_NilFieldsAreNoOp(t *testing.T) {
	rl := &model.RentalListing{
		AllowPets:   true,
		MonthlyRent: 25000,
	}
	req := UpdateRentalListingRequest{} // all nil
	applyRentalUpdate(rl, req)
	if !rl.AllowPets {
		t.Error("nil AllowPets should not change existing true value")
	}
	if rl.MonthlyRent != 25000 {
		t.Error("nil MonthlyRent should not change existing value")
	}
}

// ── Credential guard tests ────────────────────────────────────────────────────

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(_ string) (*model.User, error) { return m.user, nil }

type mockCredRepo struct{ cred *model.UserCredential }

func (m *mockCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
	return m.cred, nil
}

type stubRentalStore struct{}

func (s *stubRentalStore) Create(_ int64, _, _ float64, _ int, _ string, _, _ bool, _ int) (int64, error) {
	return 1, nil
}
func (s *stubRentalStore) FindByID(_ int64) (*model.RentalListing, error)             { return nil, nil }
func (s *stubRentalStore) FindActiveByProperty(_ int64) (*model.RentalListing, error) { return nil, nil }
func (s *stubRentalStore) ListPublic() ([]*model.RentalListing, error)                { return nil, nil }
func (s *stubRentalStore) Update(_ *model.RentalListing) error                        { return nil }
func (s *stubRentalStore) SetStatus(_ int64, _ string) error                          { return nil }
func (s *stubRentalStore) Publish(_ int64, _ int) error                               { return nil }

type stubPropertyStore struct{}

func (s *stubPropertyStore) FindByID(_ int64) (*model.Property, error) {
	return &model.Property{SetupStatus: model.PropertySetupReady}, nil
}
func (s *stubPropertyStore) ListAttachments(_ int64) ([]*model.PropertyAttachment, error) {
	return nil, nil
}

func TestRentalCreateRequiresOwnerCredential(t *testing.T) {
	user := &model.User{ID: 1}

	t.Run("no credential → ErrNoOwnerCredential", func(t *testing.T) {
		svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
		_, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
		if !errors.Is(err, ErrNoOwnerCredential) {
			t.Errorf("want ErrNoOwnerCredential, got %v", err)
		}
	})

	t.Run("has credential → credential check passes", func(t *testing.T) {
		svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: &model.UserCredential{}})
		_, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
		if errors.Is(err, ErrNoOwnerCredential) {
			t.Errorf("should not get ErrNoOwnerCredential when credential present, got %v", err)
		}
	})
}

func TestRentalCredentialCheckBeforePropertyOwnerCheck(t *testing.T) {
	user := &model.User{ID: 1}
	svc := NewService(&stubRentalStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
	_, err := svc.Create(1, "0xwallet", CreateRentalListingRequest{MonthlyRent: 20000, DurationDays: 30})
	if !errors.Is(err, ErrNoOwnerCredential) {
		t.Errorf("credential check must fire before property owner check; got %v", err)
	}
}
