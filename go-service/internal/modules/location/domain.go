package location

import "go-service/internal/db/model"

type District = model.TaiwanDistrict

type DistrictResponse struct {
	ID         int64  `json:"id"`
	County     string `json:"county"`
	District   string `json:"district"`
	PostalCode string `json:"postal_code"`
}

func ToDistrictResponse(d District) DistrictResponse {
	return DistrictResponse{
		ID:         d.ID,
		County:     d.County,
		District:   d.District,
		PostalCode: d.PostalCode,
	}
}
