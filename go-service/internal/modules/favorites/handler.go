package favorites

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	platformauth "go-service/internal/platform/auth"
)

type Handler struct{ repo *Repository }

func NewHandler(repo *Repository) *Handler { return &Handler{repo: repo} }

func walletFrom(c *gin.Context) string {
	v, _ := c.Get(platformauth.ContextWalletAddress)
	s, _ := v.(string)
	return s
}

// GET /favorites?type=SALE|RENT
func (h *Handler) List(c *gin.Context) {
	wallet := walletFrom(c)
	listingType := c.Query("type")
	if listingType != "SALE" && listingType != "RENT" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "type must be SALE or RENT"})
		return
	}
	favs, err := h.repo.ListByWallet(wallet, listingType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	resp := make([]FavoriteResponse, 0, len(favs))
	for _, f := range favs {
		resp = append(resp, FavoriteResponse{ID: f.ID, ListingType: f.ListingType, ListingID: f.ListingID})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": resp})
}

// GET /favorites/:type/:id/check
func (h *Handler) Check(c *gin.Context) {
	wallet := walletFrom(c)
	listingType := c.Param("type")
	listingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	favorited, err := h.repo.IsFavorited(wallet, listingID, listingType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"favorited": favorited}})
}

// POST /favorites
func (h *Handler) Add(c *gin.Context) {
	wallet := walletFrom(c)
	var req AddFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := h.repo.Add(wallet, req.ListingID, req.ListingType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true})
}

// DELETE /favorites/:type/:id
func (h *Handler) Remove(c *gin.Context) {
	wallet := walletFrom(c)
	listingType := c.Param("type")
	listingID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := h.repo.Remove(wallet, listingID, listingType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
