package customer

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

const (
	WatermarkShortText = "僅供本平台媒合使用，非官方驗證文件"
	WatermarkLongText  = "本文件由使用者自行提供，平台僅作為媒合資訊揭露與留存管道，不代表平台、政府機關或第三方專業單位已驗證文件真實性、完整性或法律效力。請交易雙方自行查證並視需要委託專業人士確認。"

	PlatformResponsibilityNotice = "平台透過 KYC 實名制、角色認證、文件揭露、浮水印與 hash 留存，提高媒合流程的便利性、透明度與可信度；但文件內容、屋況聲明、交易承諾與後續履約責任，仍由提供資料與參與交易的使用者自行負責。"

	WarrantyAnswerYes     = "YES"
	WarrantyAnswerNo      = "NO"
	WarrantyAnswerUnknown = "UNKNOWN"

	WarrantySeawaterConcrete = "SEAWATER_CONCRETE"
	WarrantyRadiation        = "RADIATION"
	WarrantyUnnaturalDeath   = "UNNATURAL_DEATH"
	WarrantyFireDamage       = "FIRE_DAMAGE"
	WarrantyWaterLeak        = "WATER_LEAK"
	WarrantyWallCancer       = "WALL_CANCER"
	WarrantyStructureDamage  = "STRUCTURE_DAMAGE"
	WarrantyIllegalAddition  = "ILLEGAL_ADDITION"
	WarrantyOwnershipDispute = "OWNERSHIP_DISPUTE"
	WarrantyTaxIssue         = "TAX_ISSUE"
	WarrantyLegalRestriction = "LEGAL_RESTRICTION"
	WarrantyUndisclosedLease = "UNDISCLOSED_LEASE"
	WarrantyCommunityLimit   = "COMMUNITY_LIMIT"
	WarrantyOtherDisclosure  = "OTHER_DISCLOSURE"
)

var (
	ErrPropertyAddressRequired = errors.New("property address is required")
	ErrWarrantyAnswerRequired  = errors.New("warranty answer is required")
	ErrWarrantyNoteRequired    = errors.New("warranty note is required for YES or UNKNOWN answers")
)

type DisclosureInput struct {
	OwnerUserID                  int64
	SourceCredentialSubmissionID int64
	PropertyAddress              string
	OwnershipDocNo               string
	Statement                    PropertyStatement
	Warranties                   []WarrantyAnswer
	AttachmentSummaries          []AttachmentSummary
}

type PropertyStatement struct {
	BuildingType     string  `json:"buildingType"`
	BuildingUse      string  `json:"buildingUse"`
	RegisteredPing   float64 `json:"registeredPing"`
	UsablePing       float64 `json:"usablePing"`
	Floor            int     `json:"floor"`
	TotalFloors      int     `json:"totalFloors"`
	BuildingAgeYears int     `json:"buildingAgeYears"`
	Layout           string  `json:"layout"`
	Parking          string  `json:"parking"`
	ManagementFee    float64 `json:"managementFee"`
}

type WarrantyAnswer struct {
	Code   string `json:"code"`
	Answer string `json:"answer"`
	Note   string `json:"note,omitempty"`
}

type AttachmentSummary struct {
	Kind     string `json:"kind"`
	FileName string `json:"fileName"`
	Hash     string `json:"hash,omitempty"`
}

type DisclosureSnapshot struct {
	Version                      int                 `json:"version"`
	OwnerUserID                  int64               `json:"ownerUserId"`
	SourceCredentialSubmissionID int64               `json:"sourceCredentialSubmissionId"`
	PropertyAddress              string              `json:"propertyAddress"`
	OwnershipDocNo               string              `json:"ownershipDocNo"`
	Statement                    PropertyStatement   `json:"statement"`
	Warranties                   []WarrantyAnswer    `json:"warranties"`
	AttachmentSummaries          []AttachmentSummary `json:"attachmentSummaries"`
	PlatformNotice               string              `json:"platformNotice"`
	WatermarkText                string              `json:"watermarkText"`
}

type BuiltDisclosureSnapshot struct {
	Address                string
	DeedNo                 string
	DeedHash               string
	PropertyStatementJSON  []byte
	WarrantyAnswersJSON    []byte
	DisclosureSnapshotJSON []byte
	DisclosureHash         string
}

type BuiltPropertyDraft struct {
	Address  string
	DeedNo   string
	DeedHash string
}

func BuildOwnerCredentialPropertyDraft(in DisclosureInput) (BuiltPropertyDraft, error) {
	address := strings.TrimSpace(in.PropertyAddress)
	if address == "" {
		return BuiltPropertyDraft{}, ErrPropertyAddressRequired
	}
	deedNo := strings.TrimSpace(in.OwnershipDocNo)
	deedSeed := fmt.Sprintf("%d|%d|%s|%s", in.OwnerUserID, in.SourceCredentialSubmissionID, address, deedNo)
	return BuiltPropertyDraft{
		Address:  address,
		DeedNo:   deedNo,
		DeedHash: sha256Hex([]byte(deedSeed)),
	}, nil
}

func BuildDisclosureSnapshot(in DisclosureInput) (BuiltDisclosureSnapshot, error) {
	address := strings.TrimSpace(in.PropertyAddress)
	if address == "" {
		return BuiltDisclosureSnapshot{}, ErrPropertyAddressRequired
	}

	warranties, err := normalizeWarrantyAnswers(in.Warranties)
	if err != nil {
		return BuiltDisclosureSnapshot{}, err
	}

	deedNo := strings.TrimSpace(in.OwnershipDocNo)
	statement := normalizeStatement(in.Statement)
	snapshot := DisclosureSnapshot{
		Version:                      1,
		OwnerUserID:                  in.OwnerUserID,
		SourceCredentialSubmissionID: in.SourceCredentialSubmissionID,
		PropertyAddress:              address,
		OwnershipDocNo:               deedNo,
		Statement:                    statement,
		Warranties:                   warranties,
		AttachmentSummaries:          normalizeAttachmentSummaries(in.AttachmentSummaries),
		PlatformNotice:               PlatformResponsibilityNotice,
		WatermarkText:                WatermarkShortText,
	}

	statementRaw, err := json.Marshal(statement)
	if err != nil {
		return BuiltDisclosureSnapshot{}, fmt.Errorf("property statement marshal: %w", err)
	}
	warrantiesRaw, err := json.Marshal(warranties)
	if err != nil {
		return BuiltDisclosureSnapshot{}, fmt.Errorf("property warranty answers marshal: %w", err)
	}
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return BuiltDisclosureSnapshot{}, fmt.Errorf("property disclosure snapshot marshal: %w", err)
	}

	deedSeed := fmt.Sprintf("%d|%d|%s|%s", in.OwnerUserID, in.SourceCredentialSubmissionID, address, deedNo)
	return BuiltDisclosureSnapshot{
		Address:                address,
		DeedNo:                 deedNo,
		DeedHash:               sha256Hex([]byte(deedSeed)),
		PropertyStatementJSON:  statementRaw,
		WarrantyAnswersJSON:    warrantiesRaw,
		DisclosureSnapshotJSON: raw,
		DisclosureHash:         sha256Hex(raw),
	}, nil
}

func normalizeStatement(in PropertyStatement) PropertyStatement {
	in.BuildingType = strings.TrimSpace(in.BuildingType)
	in.BuildingUse = strings.TrimSpace(in.BuildingUse)
	in.Layout = strings.TrimSpace(in.Layout)
	in.Parking = strings.TrimSpace(in.Parking)
	return in
}

func normalizeWarrantyAnswers(in []WarrantyAnswer) ([]WarrantyAnswer, error) {
	out := make([]WarrantyAnswer, 0, len(in))
	for _, item := range in {
		next := WarrantyAnswer{
			Code:   strings.TrimSpace(item.Code),
			Answer: strings.TrimSpace(item.Answer),
			Note:   strings.TrimSpace(item.Note),
		}
		if next.Code == "" || next.Answer == "" {
			return nil, ErrWarrantyAnswerRequired
		}
		if next.Answer != WarrantyAnswerYes && next.Answer != WarrantyAnswerNo && next.Answer != WarrantyAnswerUnknown {
			return nil, ErrWarrantyAnswerRequired
		}
		if (next.Answer == WarrantyAnswerYes || next.Answer == WarrantyAnswerUnknown) && next.Note == "" {
			return nil, ErrWarrantyNoteRequired
		}
		out = append(out, next)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Code < out[j].Code
	})
	return out, nil
}

func normalizeAttachmentSummaries(in []AttachmentSummary) []AttachmentSummary {
	out := make([]AttachmentSummary, 0, len(in))
	for _, item := range in {
		out = append(out, AttachmentSummary{
			Kind:     strings.TrimSpace(item.Kind),
			FileName: strings.TrimSpace(item.FileName),
			Hash:     strings.TrimSpace(item.Hash),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind == out[j].Kind {
			return out[i].FileName < out[j].FileName
		}
		return out[i].Kind < out[j].Kind
	})
	return out
}

func sha256Hex(raw []byte) string {
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
