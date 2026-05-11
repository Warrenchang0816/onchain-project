package favorites

type AddFavoriteRequest struct {
	ListingType string `json:"listing_type" binding:"required,oneof=SALE RENT"`
	ListingID   int64  `json:"listing_id"   binding:"required,min=1"`
}

type FavoriteResponse struct {
	ID          int64  `json:"id"`
	ListingType string `json:"listing_type"`
	ListingID   int64  `json:"listing_id"`
}
