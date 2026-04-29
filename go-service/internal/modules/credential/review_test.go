package credential

import "testing"

func TestEvaluateSmartReviewAgentPassesLicenseDocument(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeAgent,
		KYCName:        "王小明",
		MainOCRText:    "不動產經紀營業員 登錄字號 ABC123456 王小明",
		FormPayload: map[string]string{
			"holderName":    "王小明",
			"licenseNumber": "ABC123456",
		},
	})

	if decision.ReviewStatus != CredentialReviewPassed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s", decision.ReviewStatus, CredentialReviewPassed)
	}
	if decision.Checks["keyword"] != checkPass {
		t.Fatalf("keyword check = %s, want %s", decision.Checks["keyword"], checkPass)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkPass)
	}
	if decision.Checks["licenseNumber"] != checkPass {
		t.Fatalf("licenseNumber check = %s, want %s", decision.Checks["licenseNumber"], checkPass)
	}
}

func TestEvaluateSmartReviewOwnerFailsWithoutOwnershipKeyword(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeOwner,
		KYCName:        "王小明",
		MainOCRText:    "租賃契約 王小明",
		FormPayload: map[string]string{
			"holderName":      "王小明",
			"propertyAddress": "台北市中山區南京東路一段 1 號",
		},
	})

	if decision.ReviewStatus != CredentialReviewFailed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s", decision.ReviewStatus, CredentialReviewFailed)
	}
	if decision.Checks["keyword"] != checkFail {
		t.Fatalf("keyword check = %s, want %s", decision.Checks["keyword"], checkFail)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkPass)
	}
	if decision.Checks["addressHint"] != checkPass {
		t.Fatalf("addressHint check = %s, want %s", decision.Checks["addressHint"], checkPass)
	}
}

func TestEvaluateSmartReviewTenantPassesIncomeEvidence(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeTenant,
		KYCName:        "林小美",
		MainOCRText:    "薪資單 林小美 2026/04",
		SupportOCRText: "在職證明",
	})

	if decision.ReviewStatus != CredentialReviewPassed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s", decision.ReviewStatus, CredentialReviewPassed)
	}
	if decision.Checks["keyword"] != checkPass {
		t.Fatalf("keyword check = %s, want %s", decision.Checks["keyword"], checkPass)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkPass)
	}
}

func TestEvaluateSmartReviewAgentFailsWithoutMatchingLicenseNumber(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeAgent,
		KYCName:        "王小明",
		MainOCRText:    "不動產經紀營業員 登錄字號 ABC123456 王小明",
		FormPayload: map[string]string{
			"licenseNumber": "XYZ000000",
		},
	})

	if decision.ReviewStatus != CredentialReviewFailed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s", decision.ReviewStatus, CredentialReviewFailed)
	}
	if decision.Checks["keyword"] != checkPass {
		t.Fatalf("keyword check = %s, want %s", decision.Checks["keyword"], checkPass)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkPass)
	}
	if decision.Checks["licenseNumber"] != checkFail {
		t.Fatalf("licenseNumber check = %s, want %s", decision.Checks["licenseNumber"], checkFail)
	}
}

func TestEvaluateSmartReviewUnsupportedTypeFails(t *testing.T) {
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: "BROKER",
	})

	if decision.ReviewStatus != CredentialReviewFailed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s", decision.ReviewStatus, CredentialReviewFailed)
	}
	if decision.Checks["credentialType"] != checkFail {
		t.Fatalf("credentialType check = %s, want %s", decision.Checks["credentialType"], checkFail)
	}
}

func TestEvaluateSmartReviewTenantPassesWhenOCRMisreadsOneCharacter(t *testing.T) {
	// KYCName has rare character "徫"; OCR returns "偉" instead — bigram "張期" still matches
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeTenant,
		KYCName:        "張期徫",
		MainOCRText:    "在職證明 薪資 張期偉 2026/04",
	})

	if decision.ReviewStatus != CredentialReviewPassed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s (OCR mismatch on last char should still pass)", decision.ReviewStatus, CredentialReviewPassed)
	}
	if decision.Checks["nameMatch"] != checkPass {
		t.Fatalf("nameMatch check = %s, want %s (bigram '張期' should match)", decision.Checks["nameMatch"], checkPass)
	}
}

func TestEvaluateSmartReviewTenantFailsWhenNameCompletelyAbsent(t *testing.T) {
	// OCR text has correct keywords but a completely different name — should still fail
	decision := EvaluateSmartReview(ReviewInput{
		CredentialType: CredentialTypeTenant,
		KYCName:        "張期徫",
		MainOCRText:    "在職證明 薪資 李明德 2026/04",
	})

	if decision.ReviewStatus != CredentialReviewFailed {
		t.Fatalf("EvaluateSmartReview() status = %s, want %s (completely wrong name should fail)", decision.ReviewStatus, CredentialReviewFailed)
	}
	if decision.Checks["nameMatch"] != checkFail {
		t.Fatalf("nameMatch check = %s, want %s", decision.Checks["nameMatch"], checkFail)
	}
}
