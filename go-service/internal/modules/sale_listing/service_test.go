package sale_listing

import (
	"errors"
	"testing"

	"go-service/internal/db/model"
)

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(_ string) (*model.User, error) { return m.user, nil }

type mockCredRepo struct{ cred *model.UserCredential }

func (m *mockCredRepo) FindByUserAndType(_ int64, _ string) (*model.UserCredential, error) {
	return m.cred, nil
}

type stubSaleStore struct{}

func (s *stubSaleStore) Create(_ int64, _ float64, _ int) (int64, error)          { return 1, nil }
func (s *stubSaleStore) FindByID(_ int64) (*model.SaleListing, error)             { return nil, nil }
func (s *stubSaleStore) FindActiveByProperty(_ int64) (*model.SaleListing, error) { return nil, nil }
func (s *stubSaleStore) ListPublic() ([]*model.SaleListing, error)                { return nil, nil }
func (s *stubSaleStore) Update(_ *model.SaleListing) error                        { return nil }
func (s *stubSaleStore) SetStatus(_ int64, _ string) error                        { return nil }
func (s *stubSaleStore) Publish(_ int64, _ int) error                             { return nil }

type stubPropertyStore struct{}

func (s *stubPropertyStore) FindByID(_ int64) (*model.Property, error) {
	return &model.Property{SetupStatus: model.PropertySetupReady}, nil
}
func (s *stubPropertyStore) ListAttachments(_ int64) ([]*model.PropertyAttachment, error) {
	return nil, nil
}

func TestSaleCreateRequiresOwnerCredential(t *testing.T) {
	user := &model.User{ID: 1}

	t.Run("no credential → ErrNoOwnerCredential", func(t *testing.T) {
		svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
		_, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
		if !errors.Is(err, ErrNoOwnerCredential) {
			t.Errorf("want ErrNoOwnerCredential, got %v", err)
		}
	})

	t.Run("has credential → credential check passes", func(t *testing.T) {
		svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: &model.UserCredential{}})
		_, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
		if errors.Is(err, ErrNoOwnerCredential) {
			t.Errorf("should not get ErrNoOwnerCredential when credential present, got %v", err)
		}
	})
}

func TestSaleCredentialCheckBeforePropertyOwnerCheck(t *testing.T) {
	user := &model.User{ID: 1}
	svc := NewService(&stubSaleStore{}, &stubPropertyStore{}, &mockUserStore{user: user}, &mockCredRepo{cred: nil})
	_, err := svc.Create(1, "0xwallet", CreateSaleListingRequest{TotalPrice: 10000000, DurationDays: 30})
	if !errors.Is(err, ErrNoOwnerCredential) {
		t.Errorf("credential check must fire before property owner check; got %v", err)
	}
}
