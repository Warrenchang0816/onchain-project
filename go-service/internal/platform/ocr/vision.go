package ocr

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// VisionClient calls the Google Cloud Vision API for OCR.
type VisionClient struct {
	apiKey string
}

func NewVisionClient(apiKey string) *VisionClient {
	return &VisionClient{apiKey: apiKey}
}

// ExtractText sends imageData to Vision API and returns the full detected text.
func (c *VisionClient) ExtractText(imageData []byte) (string, error) {
	type feature struct {
		Type       string `json:"type"`
		MaxResults int    `json:"maxResults"`
	}
	type image struct {
		Content string `json:"content"`
	}
	type annotateReq struct {
		Image    image     `json:"image"`
		Features []feature `json:"features"`
	}
	type requestBody struct {
		Requests []annotateReq `json:"requests"`
	}

	body := requestBody{
		Requests: []annotateReq{
			{
				Image: image{Content: base64.StdEncoding.EncodeToString(imageData)},
				Features: []feature{
					{Type: "TEXT_DETECTION", MaxResults: 1},
				},
			},
		},
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("vision: marshal request: %w", err)
	}

	url := fmt.Sprintf("https://vision.googleapis.com/v1/images:annotate?key=%s", c.apiKey)
	resp, err := http.Post(url, "application/json", bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("vision: http post: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("vision: read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vision: API error %d: %s", resp.StatusCode, string(raw))
	}

	var result struct {
		Responses []struct {
			TextAnnotations []struct {
				Description string `json:"description"`
			} `json:"textAnnotations"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		} `json:"responses"`
	}

	if err := json.Unmarshal(raw, &result); err != nil {
		return "", fmt.Errorf("vision: unmarshal response: %w", err)
	}

	if len(result.Responses) == 0 {
		return "", nil
	}
	if result.Responses[0].Error != nil {
		return "", fmt.Errorf("vision: %s", result.Responses[0].Error.Message)
	}
	if len(result.Responses[0].TextAnnotations) == 0 {
		return "", nil
	}

	// Index 0 = full text block
	return strings.ToValidUTF8(result.Responses[0].TextAnnotations[0].Description, ""), nil
}
