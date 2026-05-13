package property

import (
	"context"
	"testing"
	"time"

	"go-service/internal/db/model"
)

// mockStore implements Store with in-memory state.
type mockStore struct {
	property    *model.Property
	attachments []*model.PropertyAttachment
	nextID      int64
}

func (m *mockStore) Create(ownerUserID int64, title, address string) (int64, error) { return 0, nil }
func (m *mockStore) FindByID(id int64) (*model.Property, error)                     { return m.property, nil }
func (m *mockStore) ListByOwner(ownerUserID int64) ([]*model.Property, error)       { return nil, nil }
func (m *mockStore) Update(p *model.Property) error                                 { return nil }
func (m *mockStore) SetSetupStatus(id int64, status string, _ time.Time) error      { return nil }
func (m *mockStore) HasActiveListing(propertyID int64) (bool, error)                { return false, nil }
func (m *mockStore) AddAttachment(propertyID int64, attachType, url string) (int64, error) {
	m.nextID++
	m.attachments = append(m.attachments, &model.PropertyAttachment{
		ID: m.nextID, PropertyID: propertyID, Type: attachType, URL: url,
	})
	return m.nextID, nil
}
func (m *mockStore) DeleteAttachment(propertyID, attachmentID int64) error { return nil }
func (m *mockStore) ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error) {
	return m.attachments, nil
}

type mockUserStore struct{ user *model.User }

func (m *mockUserStore) FindByWallet(wallet string) (*model.User, error) { return m.user, nil }

func TestUploadPhoto_RejectsAtLimit(t *testing.T) {
	prop := &model.Property{
		ID: 1, OwnerUserID: 1,
		Title: "test", Address: "addr", BuildingType: "BUILDING",
		SetupStatus: model.PropertySetupDraft,
	}
	// Prefill 10 PHOTO attachments
	atts := make([]*model.PropertyAttachment, 10)
	for i := range atts {
		atts[i] = &model.PropertyAttachment{ID: int64(i + 1), Type: model.AttachmentTypePhoto}
	}
	store := &mockStore{property: prop, attachments: atts, nextID: 10}
	userStore := &mockUserStore{user: &model.User{ID: 1}}
	// nil storage: count check fires before storage is touched
	svc := NewService(store, userStore, nil, "")

	_, _, err := svc.UploadPhoto(context.Background(), 1, "wallet", []byte("img"), "image/jpeg")
	if err == nil {
		t.Fatal("expected error when photo count is 10, got nil")
	}
	want := "已達照片上限（10 張）"
	if err.Error() != want {
		t.Fatalf("got error %q, want %q", err.Error(), want)
	}
}

func TestUploadPhoto_PassesCountCheckWith9Photos(t *testing.T) {
	prop := &model.Property{
		ID: 1, OwnerUserID: 1,
		Title: "test", Address: "addr", BuildingType: "BUILDING",
		SetupStatus: model.PropertySetupDraft,
	}
	// 9 existing photos — one more should be allowed (but storage is nil → different error)
	atts := make([]*model.PropertyAttachment, 9)
	for i := range atts {
		atts[i] = &model.PropertyAttachment{ID: int64(i + 1), Type: model.AttachmentTypePhoto}
	}
	store := &mockStore{property: prop, attachments: atts, nextID: 9}
	userStore := &mockUserStore{user: &model.User{ID: 1}}
	svc := NewService(store, userStore, nil, "")

	_, _, err := svc.UploadPhoto(context.Background(), 1, "wallet", []byte("img"), "image/jpeg")
	// Storage is nil → "photo storage not configured", NOT the limit error
	if err == nil {
		t.Fatal("expected an error (nil storage), got nil")
	}
	if err.Error() == "已達照片上限（10 張）" {
		t.Fatal("should not have hit limit with 9 photos")
	}
}
