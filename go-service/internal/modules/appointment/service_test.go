package appointment

import (
	"testing"
	"time"

	"go-service/internal/db/model"
)

type fakeAppts struct {
	byID      map[int64]*model.ListingAppointment
	byPropVis map[[2]int64]*model.ListingAppointment
	created   []*model.ListingAppointment
	nextPos   int
	confirmed bool
}

func (f *fakeAppts) FindByID(id int64) (*model.ListingAppointment, error)        { return f.byID[id], nil }
func (f *fakeAppts) FindByProperty(p int64) ([]*model.ListingAppointment, error) { return nil, nil }
func (f *fakeAppts) FindByPropertyAndVisitor(p, v int64) (*model.ListingAppointment, error) {
	return f.byPropVis[[2]int64{p, v}], nil
}
func (f *fakeAppts) NextQueuePosition(p int64) (int, error) { return f.nextPos, nil }
func (f *fakeAppts) Create(p, v int64, pos int, t time.Time, note *string) (int64, error) {
	a := &model.ListingAppointment{ID: 100, PropertyID: p, VisitorUserID: v, QueuePosition: pos, Status: model.AppointmentStatusPending}
	f.created = append(f.created, a)
	f.byID[100] = a
	return 100, nil
}
func (f *fakeAppts) SetStatus(id int64, s string) error  { return nil }
func (f *fakeAppts) Confirm(id int64, t time.Time) error { f.confirmed = true; return nil }

type fakeRentals struct{ rl *model.RentalListing }

func (f *fakeRentals) FindByID(id int64) (*model.RentalListing, error) { return f.rl, nil }

type fakeProps struct{ prop *model.Property }

func (f *fakeProps) FindByID(id int64) (*model.Property, error) { return f.prop, nil }

type fakeUsers struct{ user *model.User }

func (f *fakeUsers) FindByWallet(w string) (*model.User, error) { return f.user, nil }

func newSvc(a *fakeAppts) (*Service, *fakeProps, *fakeUsers) {
	props := &fakeProps{prop: &model.Property{ID: 7, OwnerUserID: 42}}
	users := &fakeUsers{user: &model.User{ID: 42}}
	rentals := &fakeRentals{rl: &model.RentalListing{ID: 5, PropertyID: 7}}
	return NewService(a, rentals, props, users), props, users
}

func TestBookForRentalListing_resolvesPropertyAndCreates(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{}, nextPos: 1}
	svc, _, _ := newSvc(a)
	id, err := svc.BookForRentalListing(5, 99, time.Now(), nil)
	if err != nil || id != 100 {
		t.Fatalf("want id=100 err=nil, got id=%d err=%v", id, err)
	}
	if len(a.created) != 1 || a.created[0].PropertyID != 7 {
		t.Fatalf("expected appointment created for property 7, got %+v", a.created)
	}
}

func TestBookForRentalListing_duplicateActiveBlocked(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{
		{7, 99}: {ID: 1, PropertyID: 7, VisitorUserID: 99, Status: model.AppointmentStatusPending},
	}, nextPos: 2}
	svc, _, _ := newSvc(a)
	if _, err := svc.BookForRentalListing(5, 99, time.Now(), nil); err != ErrForbidden {
		t.Fatalf("want ErrForbidden, got %v", err)
	}
}

func TestSetStatus_invalidTransitionRejected(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{
		1: {ID: 1, PropertyID: 7, Status: model.AppointmentStatusPending},
	}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, _ := newSvc(a)
	if err := svc.SetStatus(1, "0xowner", model.AppointmentStatusViewed); err != ErrInvalidStatus {
		t.Fatalf("want ErrInvalidStatus, got %v", err)
	}
}

func TestConfirm_nonOwnerForbidden(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{
		1: {ID: 1, PropertyID: 7, Status: model.AppointmentStatusPending},
	}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, users := newSvc(a)
	users.user = &model.User{ID: 999}
	if err := svc.Confirm(1, "0xother", time.Now()); err != ErrForbidden {
		t.Fatalf("want ErrForbidden, got %v", err)
	}
}

func TestBookForRentalListing_allowedAfterCancelled(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{
		{7, 99}: {ID: 1, PropertyID: 7, VisitorUserID: 99, Status: model.AppointmentStatusCancelled},
	}, nextPos: 2}
	svc, _, _ := newSvc(a)
	id, err := svc.BookForRentalListing(5, 99, time.Now(), nil)
	if err != nil || id != 100 {
		t.Fatalf("re-book after CANCELLED should succeed, got id=%d err=%v", id, err)
	}
}

func TestConfirm_ownerValidTransitionSucceeds(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{
		1: {ID: 1, PropertyID: 7, Status: model.AppointmentStatusPending},
	}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, _ := newSvc(a) // owner user ID 42 matches property owner
	if err := svc.Confirm(1, "0xowner", time.Now()); err != nil {
		t.Fatalf("owner confirming PENDING appt should succeed, got %v", err)
	}
	if !a.confirmed {
		t.Fatalf("expected Confirm to be called on store")
	}
}

func TestListForOwner_nonOwnerForbidden(t *testing.T) {
	a := &fakeAppts{byID: map[int64]*model.ListingAppointment{}, byPropVis: map[[2]int64]*model.ListingAppointment{}}
	svc, _, users := newSvc(a)
	users.user = &model.User{ID: 999} // not the owner (42)
	if _, err := svc.ListForOwner(7, "0xother"); err != ErrForbidden {
		t.Fatalf("want ErrForbidden, got %v", err)
	}
}
