package customer

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"go-service/internal/db/model"
)

type fakePropertyService struct {
	listWallet string
	updateID   int64
	confirmID  int64
}

func (f *fakePropertyService) ListMine(wallet string) ([]*model.Customer, error) {
	f.listWallet = wallet
	return []*model.Customer{
		{ID: 11, OwnerUserID: 7, Address: "Taipei Main Road 100", VerificationStatus: model.CustomerVerificationDraft, CompletenessStatus: model.CustomerCompletenessDisclosureRequired},
	}, nil
}

func (f *fakePropertyService) GetForOwner(id int64, wallet string) (*model.Customer, error) {
	return &model.Customer{ID: id, OwnerUserID: 7, Address: "Taipei Main Road 100"}, nil
}

func (f *fakePropertyService) UpdateDisclosureForOwner(id int64, wallet string, in DisclosureInput) error {
	f.updateID = id
	return nil
}

func (f *fakePropertyService) ConfirmDisclosureForOwner(id int64, wallet string) error {
	f.confirmID = id
	return nil
}

func TestListMyPropertiesUsesAuthenticatedWallet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := &fakePropertyService{}
	h := NewHandler(svc)
	r := gin.New()
	r.GET("/properties/mine", func(c *gin.Context) {
		c.Set("walletAddress", "0xowner")
		h.ListMyProperties(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/properties/mine", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if svc.listWallet != "0xowner" {
		t.Fatalf("wallet = %q, want 0xowner", svc.listWallet)
	}
	if !strings.Contains(rec.Body.String(), `"id":11`) {
		t.Fatalf("response body missing property id: %s", rec.Body.String())
	}
}
