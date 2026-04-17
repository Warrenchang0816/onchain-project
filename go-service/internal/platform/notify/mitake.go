package notify

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// MitakeConfig holds 三竹簡訊 credentials.
type MitakeConfig struct {
	Username string
	Password string
}

// MitakeSender sends SMS via 三竹簡訊 (mitake.com.tw).
type MitakeSender struct {
	cfg    MitakeConfig
	client *http.Client
}

func NewMitakeSender(cfg MitakeConfig) *MitakeSender {
	return &MitakeSender{cfg: cfg, client: &http.Client{}}
}

// SendOTP sends a 6-digit OTP to the given phone number.
// Phone format: Taiwan local (09xxxxxxxx) or international (+8869xxxxxxxx).
// If cfg.Username is empty the message is printed to the log only (dev mode).
func (s *MitakeSender) SendOTP(phone, code string) error {
	msg := fmt.Sprintf("【可信房屋平台】驗證碼：%s，5分鐘內有效，請勿分享。", code)

	if s.cfg.Username == "" {
		log.Printf("[notify/mitake] DEV MODE — to=%s code=%s", phone, code)
		return nil
	}

	params := url.Values{}
	params.Set("username", s.cfg.Username)
	params.Set("password", s.cfg.Password)
	params.Set("dstaddr", phone)
	params.Set("smbody", msg)

	endpoint := "https://sms.mitake.com.tw/b2c/mtk/SmSend"
	resp, err := s.client.PostForm(endpoint, params)
	if err != nil {
		return fmt.Errorf("notify/mitake: http post: %w", err)
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)
	body := string(rawBody)

	// Mitake returns plain-text result lines like: statuscode=0\n...
	if !strings.Contains(body, "statuscode=0") {
		return fmt.Errorf("notify/mitake: send failed: %s", body)
	}
	return nil
}
