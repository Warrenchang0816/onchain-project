package credential

import "strings"

const (
	checkPass = "PASS"
	checkFail = "FAIL"
)

type ReviewInput struct {
	CredentialType string
	KYCName        string
	KYCAddress     string
	MainOCRText    string
	SupportOCRText string
	FormPayload    map[string]string
}

type ReviewDecision struct {
	ReviewStatus string
	Summary      string
	Checks       map[string]string
}

func EvaluateSmartReview(in ReviewInput) ReviewDecision {
	credentialType, err := NormalizeType(in.CredentialType)
	if err != nil {
		return failedDecision("不支援的身份類型", map[string]string{
			"credentialType": checkFail,
		})
	}

	combined := normalizeReviewText(in.MainOCRText + "\n" + in.SupportOCRText)
	subjectName := firstNonEmpty(strings.TrimSpace(in.KYCName), formValue(in.FormPayload, "holderName"))
	nameMatch := partialNameMatch(subjectName, combined)

	switch credentialType {
	case CredentialTypeOwner:
		hasOwnershipKeyword := containsAny(combined,
			"建物所有權狀",
			"所有權人",
			"權利範圍",
			"不動產",
		)
		addressHint := formValue(in.FormPayload, "propertyAddress") != ""
		if hasOwnershipKeyword && nameMatch && addressHint {
			return passedDecision("文件符合屋主最低辨識條件", map[string]string{
				"keyword":     checkPass,
				"nameMatch":   checkPass,
				"addressHint": checkPass,
			})
		}
		return failedDecision("文件未通過屋主最低辨識條件", map[string]string{
			"keyword":     passOrFail(hasOwnershipKeyword),
			"nameMatch":   passOrFail(nameMatch),
			"addressHint": passOrFail(addressHint),
		})
	case CredentialTypeTenant:
		hasTenantKeyword := containsAny(combined,
			"薪資",
			"在職",
			"扣繳",
			"勞保",
			"所得",
		)
		if hasTenantKeyword && nameMatch {
			return passedDecision("文件符合租客最低辨識條件", map[string]string{
				"keyword":   checkPass,
				"nameMatch": checkPass,
			})
		}
		return failedDecision("文件未通過租客最低辨識條件", map[string]string{
			"keyword":   passOrFail(hasTenantKeyword),
			"nameMatch": passOrFail(nameMatch),
		})
	case CredentialTypeAgent:
		hasAgentKeyword := containsAny(combined,
			"不動產經紀",
			"營業員",
			"經紀人",
			"登錄字號",
			"證照",
		)
		licenseNumber := formValue(in.FormPayload, "licenseNumber")
		licenseMatch := licenseNumber != "" && strings.Contains(combined, normalizeReviewText(licenseNumber))
		if hasAgentKeyword && nameMatch && licenseMatch {
			return passedDecision("文件符合仲介最低辨識條件", map[string]string{
				"keyword":       checkPass,
				"nameMatch":     checkPass,
				"licenseNumber": checkPass,
			})
		}
		return failedDecision("文件未通過仲介最低辨識條件", map[string]string{
			"keyword":       passOrFail(hasAgentKeyword),
			"nameMatch":     passOrFail(nameMatch),
			"licenseNumber": passOrFail(licenseMatch),
		})
	default:
		return failedDecision("不支援的身份類型", map[string]string{
			"credentialType": checkFail,
		})
	}
}

func containsAny(text string, values ...string) bool {
	for _, value := range values {
		if strings.Contains(text, normalizeReviewText(value)) {
			return true
		}
	}
	return false
}

func passOrFail(ok bool) string {
	if ok {
		return checkPass
	}
	return checkFail
}

func passedDecision(summary string, checks map[string]string) ReviewDecision {
	return ReviewDecision{
		ReviewStatus: CredentialReviewPassed,
		Summary:      summary,
		Checks:       checks,
	}
}

func failedDecision(summary string, checks map[string]string) ReviewDecision {
	return ReviewDecision{
		ReviewStatus: CredentialReviewFailed,
		Summary:      summary,
		Checks:       checks,
	}
}

func normalizeReviewText(text string) string {
	return strings.ToUpper(strings.TrimSpace(text))
}

func formValue(values map[string]string, key string) string {
	if values == nil {
		return ""
	}
	return strings.TrimSpace(values[key])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

// partialNameMatch returns true if any consecutive 2-character bigram from name
// appears in combined. Both strings are normalised internally, so callers do not
// need to pre-normalise either argument.
// A 2-char sliding window tolerates one OCR-misread character at the end of a
// 3-char (or longer) name without losing the whole match. For 2-char names the
// only bigram is the full name itself, so no OCR tolerance is provided.
func partialNameMatch(name, combined string) bool {
	if name == "" {
		return false
	}
	combined = normalizeReviewText(combined)
	runes := []rune(name)
	if len(runes) < 2 {
		return strings.Contains(combined, normalizeReviewText(name))
	}
	for i := 0; i <= len(runes)-2; i++ {
		bigram := normalizeReviewText(string(runes[i : i+2]))
		if strings.Contains(combined, bigram) {
			return true
		}
	}
	return false
}
