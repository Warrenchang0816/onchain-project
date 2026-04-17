package ocr

import (
    "regexp"
    "strings"
)

// IDCardFront holds OCR-extracted fields from the front side of a Taiwan ID card.
type IDCardFront struct {
    Name          string
    IDNumber      string
    BirthDate     string
    IssueDate     string
    IssueLocation string
}

// IDCardBack holds OCR-extracted fields from the back side of a Taiwan ID card.
type IDCardBack struct {
    Address    string
    FatherName string
    MotherName string
    SpouseName string
}

func ParseFront(ocrText string) IDCardFront {
    text := cleanOCRText(ocrText)
    lines := splitLines(text)
    var f IDCardFront

    f.IDNumber = extractTaiwanIDNumber(text)

    rocDateRe := regexp.MustCompile(`(\d{2,3})[./年\-\s](\d{1,2})[./月\-\s](\d{1,2})`) 
    dates := rocDateRe.FindAllString(text, -1)
    if len(dates) >= 1 {
        f.BirthDate = normaliseDate(dates[0])
    }
    if len(dates) >= 2 {
        f.IssueDate = normaliseDate(dates[1])
    }

    f.Name = extractAfterKeyword(lines, []string{"姓名", "Name"})
    f.IssueLocation = extractAfterKeyword(lines, []string{"發證地", "發證縣市", "Issued At"})

    if f.Name == "" {
        f.Name = extractTaiwanName(lines)
    }

    return f
}

func ParseBack(ocrText string) IDCardBack {
    text := cleanOCRText(ocrText)
    lines := splitLines(text)
    var b IDCardBack

    b.Address = extractAfterKeyword(lines, []string{"住址", "地址", "Address"})

    for _, line := range lines {
        line = strings.TrimSpace(line)
        switch {
        case strings.HasPrefix(line, "父") && b.FatherName == "":
            b.FatherName = extractInlineValue(line, "父")
        case strings.HasPrefix(line, "母") && b.MotherName == "":
            b.MotherName = extractInlineValue(line, "母")
        case strings.HasPrefix(line, "配偶") && b.SpouseName == "":
            b.SpouseName = extractInlineValue(line, "配偶")
        }
    }

    if b.FatherName == "" {
        b.FatherName = extractAfterKeyword(lines, []string{"父"})
    }
    if b.MotherName == "" {
        b.MotherName = extractAfterKeyword(lines, []string{"母"})
    }
    if b.SpouseName == "" {
        b.SpouseName = extractAfterKeyword(lines, []string{"配偶"})
    }

    return b
}

func cleanOCRText(s string) string {
    s = strings.ToValidUTF8(s, "")
    s = strings.ReplaceAll(s, "\u0000", "")
    s = strings.ReplaceAll(s, "\r\n", "\n")
    s = strings.ReplaceAll(s, "\r", "\n")
    return strings.TrimSpace(s)
}

func splitLines(s string) []string {
    return strings.Split(cleanOCRText(s), "\n")
}

func extractAfterKeyword(lines []string, keywords []string) string {
    for i, line := range lines {
        line = strings.TrimSpace(line)
        for _, kw := range keywords {
            if idx := strings.Index(line, kw); idx != -1 {
                rest := strings.TrimSpace(strings.TrimPrefix(line[idx:], kw))
                rest = strings.TrimLeft(rest, ":： ")
                if rest != "" {
                    return cleanFieldValue(rest)
                }
                for j := i + 1; j < len(lines); j++ {
                    next := strings.TrimSpace(lines[j])
                    if next != "" {
                        return cleanFieldValue(next)
                    }
                }
            }
        }
    }
    return ""
}

func extractInlineValue(line, keyword string) string {
    value := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), keyword))
    value = strings.TrimLeft(value, ":： ")
    return cleanFieldValue(value)
}

func extractTaiwanName(lines []string) string {
    nameRe := regexp.MustCompile(`^[\p{Han}]{2,4}$`)
    for _, line := range lines {
        candidate := cleanFieldValue(line)
        if nameRe.MatchString(candidate) {
            return candidate
        }
    }
    return ""
}

// ExtractTaiwanIDNumber tries several strategies to find a Taiwan ID number
// (format: one uppercase letter + 9 digits) in raw OCR text:
//  1. Standard match on the original (uppercased) text.
//  2. After removing all whitespace (handles OCR-inserted spaces).
//  3. After whitespace removal + common OCR digit corrections (O→0, I/L→1).
func ExtractTaiwanIDNumber(text string) string {
	return extractTaiwanIDNumber(text)
}

func extractTaiwanIDNumber(text string) string {
    upperText := strings.ToUpper(text)
    idRe := regexp.MustCompile(`[A-Z][0-9]{9}`)

    // Pass 1: direct match
    if m := idRe.FindString(upperText); m != "" {
        return m
    }

    // Pass 2: collapse all whitespace then match
    compact := regexp.MustCompile(`\s+`).ReplaceAllString(upperText, "")
    if m := idRe.FindString(compact); m != "" {
        return m
    }

    // Pass 3: OCR corrections on the digit portion (O→0, I/L→1)
    looseRe := regexp.MustCompile(`([A-Z])([A-Z0-9]{9})`)
    ocrFix := strings.NewReplacer("O", "0", "I", "1", "L", "1")
    for _, m := range looseRe.FindAllStringSubmatch(compact, -1) {
        corrected := m[1] + ocrFix.Replace(m[2])
        if idRe.MatchString(corrected) {
            return corrected
        }
    }

    return ""
}

func cleanFieldValue(s string) string {
    s = cleanOCRText(s)
    s = strings.ReplaceAll(s, "'", "")
    s = strings.ReplaceAll(s, "\t", " ")
    s = strings.Join(strings.Fields(s), " ")
    return s
}

func normaliseDate(raw string) string {
    re := regexp.MustCompile(`(\d{2,3})[./年\-\s](\d{1,2})[./月\-\s](\d{1,2})`)
    m := re.FindStringSubmatch(raw)
    if m == nil {
        return cleanFieldValue(raw)
    }
    return m[1] + "/" + m[2] + "/" + m[3]
}
