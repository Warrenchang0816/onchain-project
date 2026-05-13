package property

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"go-service/internal/db/model"
	"go-service/internal/platform/storage"
)

var (
	ErrNotFound       = errors.New("property not found")
	ErrForbidden      = errors.New("only the property owner can perform this action")
	ErrNotOwner       = errors.New("KYC verified owner credential required")
	ErrPropertyListed = errors.New("物件上架中，無法移除")
)

type Store interface {
	Create(ownerUserID int64, title, address string) (int64, error)
	FindByID(id int64) (*model.Property, error)
	ListByOwner(ownerUserID int64) ([]*model.Property, error)
	Update(p *model.Property) error
	SetSetupStatus(id int64, status string, updatedAt time.Time) error
	HasActiveListing(propertyID int64) (bool, error)
	AddAttachment(propertyID int64, attachType, url string) (int64, error)
	DeleteAttachment(propertyID, attachmentID int64) error
	ListAttachments(propertyID int64) ([]*model.PropertyAttachment, error)
}

type UserStore interface {
	FindByWallet(wallet string) (*model.User, error)
}

type Service struct {
	repo       Store
	userRepo   UserStore
	storageSvc *storage.Client
	apiBaseURL string
}

func NewService(repo Store, userRepo UserStore, storageSvc *storage.Client, apiBaseURL string) *Service {
	return &Service{repo: repo, userRepo: userRepo, storageSvc: storageSvc, apiBaseURL: apiBaseURL}
}

func (s *Service) Create(wallet, title, address string) (int64, error) {
	user, err := s.requireOwner(wallet)
	if err != nil {
		return 0, err
	}
	id, err := s.repo.Create(user.ID, title, address)
	if err != nil {
		return 0, fmt.Errorf("property: Create: %w", err)
	}
	return id, nil
}

func (s *Service) ListMine(wallet string) ([]*model.Property, error) {
	user, err := s.requireOwner(wallet)
	if err != nil {
		return nil, err
	}
	props, err := s.repo.ListByOwner(user.ID)
	if err != nil {
		return nil, fmt.Errorf("property: ListMine: %w", err)
	}
	for _, p := range props {
		atts, _ := s.repo.ListAttachments(p.ID)
		p.Attachments = atts
	}
	return props, nil
}

func (s *Service) GetForOwner(id int64, wallet string) (*model.Property, error) {
	p, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("property: GetForOwner: %w", err)
	}
	if p == nil {
		return nil, ErrNotFound
	}
	user, err := s.requireOwner(wallet)
	if err != nil {
		return nil, err
	}
	if p.OwnerUserID != user.ID {
		return nil, ErrForbidden
	}
	atts, _ := s.repo.ListAttachments(p.ID)
	p.Attachments = atts
	return p, nil
}

func (s *Service) Update(id int64, wallet string, req UpdatePropertyRequest) error {
	p, err := s.GetForOwner(id, wallet)
	if err != nil {
		return err
	}
	applyUpdate(p, req)
	p.SetupStatus = computeSetupStatus(p)
	p.UpdatedAt = time.Now()
	if err := s.repo.Update(p); err != nil {
		return fmt.Errorf("property: Update: %w", err)
	}
	return nil
}

func (s *Service) AddAttachment(propertyID int64, wallet, attachType, url string) (int64, error) {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return 0, err
	}
	id, err := s.repo.AddAttachment(propertyID, attachType, url)
	if err != nil {
		return 0, fmt.Errorf("property: AddAttachment: %w", err)
	}
	p, _ := s.repo.FindByID(propertyID)
	if p != nil {
		atts, _ := s.repo.ListAttachments(propertyID)
		p.Attachments = atts
		newStatus := computeSetupStatus(p)
		if newStatus != p.SetupStatus {
			_ = s.repo.SetSetupStatus(propertyID, newStatus, time.Now())
		}
	}
	return id, nil
}

func (s *Service) DeleteAttachment(propertyID, attachmentID int64, wallet string) error {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return err
	}
	return s.repo.DeleteAttachment(propertyID, attachmentID)
}

func (s *Service) RemoveProperty(ctx context.Context, propertyID int64, wallet string) error {
	user, err := s.requireOwner(wallet)
	if err != nil {
		return err
	}
	prop, err := s.repo.FindByID(propertyID)
	if err != nil {
		return fmt.Errorf("property: RemoveProperty: %w", err)
	}
	if prop == nil {
		return ErrNotFound
	}
	if prop.OwnerUserID != user.ID {
		return ErrForbidden
	}
	if prop.SetupStatus != model.PropertySetupDraft && prop.SetupStatus != model.PropertySetupReady {
		return fmt.Errorf("only DRAFT or READY properties can be removed")
	}
	hasActive, err := s.repo.HasActiveListing(propertyID)
	if err != nil {
		return err
	}
	if hasActive {
		return ErrPropertyListed
	}
	return s.repo.SetSetupStatus(propertyID, model.PropertySetupRemoved, time.Now())
}

func computeSetupStatus(p *model.Property) string {
	if p.Title == "" || p.Address == "" || p.BuildingType == "" {
		return model.PropertySetupDraft
	}
	hasPhoto := false
	for _, a := range p.Attachments {
		if a.Type == model.AttachmentTypePhoto {
			hasPhoto = true
			break
		}
	}
	if !hasPhoto {
		return model.PropertySetupDraft
	}
	return model.PropertySetupReady
}

func applyUpdate(p *model.Property, req UpdatePropertyRequest) {
	if req.Title != "" {
		p.Title = req.Title
	}
	if req.Address != "" {
		p.Address = req.Address
	}
	if req.BuildingType != "" {
		p.BuildingType = req.BuildingType
	}
	if req.Floor != nil {
		p.Floor = sql.NullInt32{Int32: *req.Floor, Valid: true}
	}
	if req.TotalFloors != nil {
		p.TotalFloors = sql.NullInt32{Int32: *req.TotalFloors, Valid: true}
	}
	if req.MainArea != nil {
		p.MainArea = sql.NullFloat64{Float64: *req.MainArea, Valid: true}
	}
	if req.AuxiliaryArea != nil {
		p.AuxiliaryArea = sql.NullFloat64{Float64: *req.AuxiliaryArea, Valid: true}
	}
	if req.BalconyArea != nil {
		p.BalconyArea = sql.NullFloat64{Float64: *req.BalconyArea, Valid: true}
	}
	if req.SharedArea != nil {
		p.SharedArea = sql.NullFloat64{Float64: *req.SharedArea, Valid: true}
	}
	if req.AwningArea != nil {
		p.AwningArea = sql.NullFloat64{Float64: *req.AwningArea, Valid: true}
	}
	if req.LandArea != nil {
		p.LandArea = sql.NullFloat64{Float64: *req.LandArea, Valid: true}
	}
	if req.Rooms != nil {
		p.Rooms = sql.NullInt32{Int32: *req.Rooms, Valid: true}
	}
	if req.LivingRooms != nil {
		p.LivingRooms = sql.NullInt32{Int32: *req.LivingRooms, Valid: true}
	}
	if req.Bathrooms != nil {
		p.Bathrooms = sql.NullInt32{Int32: *req.Bathrooms, Valid: true}
	}
	if req.IsCornerUnit != nil {
		p.IsCornerUnit = *req.IsCornerUnit
	}
	if req.HasDarkRoom != nil {
		p.HasDarkRoom = *req.HasDarkRoom
	}
	if req.BuildingAge != nil {
		p.BuildingAge = sql.NullInt32{Int32: *req.BuildingAge, Valid: true}
	}
	if req.BuildingStructure != nil {
		p.BuildingStructure = sql.NullString{String: *req.BuildingStructure, Valid: true}
	}
	if req.ExteriorMaterial != nil {
		p.ExteriorMaterial = sql.NullString{String: *req.ExteriorMaterial, Valid: true}
	}
	if req.BuildingUsage != nil {
		p.BuildingUsage = sql.NullString{String: *req.BuildingUsage, Valid: true}
	}
	if req.Zoning != nil {
		p.Zoning = sql.NullString{String: *req.Zoning, Valid: true}
	}
	if req.UnitsOnFloor != nil {
		p.UnitsOnFloor = sql.NullInt32{Int32: *req.UnitsOnFloor, Valid: true}
	}
	if req.BuildingOrientation != nil {
		p.BuildingOrientation = sql.NullString{String: *req.BuildingOrientation, Valid: true}
	}
	if req.WindowOrientation != nil {
		p.WindowOrientation = sql.NullString{String: *req.WindowOrientation, Valid: true}
	}
	if req.ParkingType != nil {
		p.ParkingType = *req.ParkingType
	}
	if req.ManagementFee != nil {
		p.ManagementFee = sql.NullFloat64{Float64: *req.ManagementFee, Valid: true}
	}
	if req.SecurityType != nil {
		p.SecurityType = *req.SecurityType
	}
}

func (s *Service) requireOwner(wallet string) (*model.User, error) {
	user, err := s.userRepo.FindByWallet(wallet)
	if err != nil {
		return nil, fmt.Errorf("property: lookup user: %w", err)
	}
	if user == nil {
		return nil, ErrNotOwner
	}
	return user, nil
}

func newPhotoUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x%x%x%x%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func extFromContentType(ct string) string {
	switch strings.ToLower(strings.SplitN(ct, ";", 2)[0]) {
	case "image/png":
		return "png"
	case "image/gif":
		return "gif"
	case "image/webp":
		return "webp"
	default:
		return "jpg"
	}
}

func contentTypeFromFilename(filename string) string {
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

func (s *Service) UploadPhoto(ctx context.Context, propertyID int64, wallet string, data []byte, contentType string) (attachID int64, proxyURL string, err error) {
	if _, err := s.GetForOwner(propertyID, wallet); err != nil {
		return 0, "", err
	}
	atts, err := s.repo.ListAttachments(propertyID)
	if err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto list: %w", err)
	}
	count := 0
	for _, a := range atts {
		if a.Type == model.AttachmentTypePhoto {
			count++
		}
	}
	if count >= 10 {
		return 0, "", errors.New("已達照片上限（10 張）")
	}
	if s.storageSvc == nil {
		return 0, "", errors.New("photo storage not configured")
	}
	uuid := newPhotoUUID()
	ext := extFromContentType(contentType)
	objectPath := fmt.Sprintf("property/%d/photos/%s.%s", propertyID, uuid, ext)
	if err := s.storageSvc.Upload(ctx, objectPath, data, contentType); err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto upload: %w", err)
	}
	proxyURL = fmt.Sprintf("%s/api/property/%d/photos/%s.%s", s.apiBaseURL, propertyID, uuid, ext)
	attachID, err = s.repo.AddAttachment(propertyID, model.AttachmentTypePhoto, proxyURL)
	if err != nil {
		return 0, "", fmt.Errorf("property: UploadPhoto add: %w", err)
	}
	// Update setup status without re-checking ownership.
	p, _ := s.repo.FindByID(propertyID)
	if p != nil {
		updatedAtts, _ := s.repo.ListAttachments(propertyID)
		p.Attachments = updatedAtts
		newStatus := computeSetupStatus(p)
		if newStatus != p.SetupStatus {
			_ = s.repo.SetSetupStatus(propertyID, newStatus, time.Now())
		}
	}
	return attachID, proxyURL, nil
}

func (s *Service) DownloadPhoto(ctx context.Context, propertyID int64, filename string) ([]byte, string, error) {
	if s.storageSvc == nil {
		return nil, "", errors.New("photo storage not configured")
	}
	objectPath := fmt.Sprintf("property/%d/photos/%s", propertyID, filename)
	data, err := s.storageSvc.Download(ctx, objectPath)
	if err != nil {
		return nil, "", fmt.Errorf("property: DownloadPhoto: %w", err)
	}
	return data, contentTypeFromFilename(filename), nil
}
