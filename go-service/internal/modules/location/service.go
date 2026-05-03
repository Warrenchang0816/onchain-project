package location

import "go-service/internal/db/model"

type DistrictStore interface {
	ListTaiwanDistricts() ([]model.TaiwanDistrict, error)
}

type Service struct {
	store DistrictStore
}

func NewService(store DistrictStore) *Service {
	return &Service{store: store}
}

func (s *Service) ListDistricts() ([]DistrictResponse, error) {
	districts, err := s.store.ListTaiwanDistricts()
	if err != nil {
		return nil, err
	}
	resp := make([]DistrictResponse, 0, len(districts))
	for _, d := range districts {
		resp = append(resp, ToDistrictResponse(d))
	}
	return resp, nil
}
