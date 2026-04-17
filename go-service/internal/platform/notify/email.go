// Package notify provides OTP delivery via email (SMTP) and SMS (Mitake).
package notify

import (
	"fmt"
	"log"
	"net/smtp"
	"strings"
)

// EmailConfig holds SMTP credentials.
type EmailConfig struct {
	Host string // e.g. "smtp.gmail.com"
	Port string // e.g. "587"
	User string
	Pass string
	From string // display address, e.g. "no-reply@yourdomain.com"
}

// EmailSender sends transactional emails via SMTP.
type EmailSender struct {
	cfg EmailConfig
}

func NewEmailSender(cfg EmailConfig) *EmailSender {
	return &EmailSender{cfg: cfg}
}

// SendOTP sends a 6-digit OTP to the given email address.
// If cfg.Host is empty the message is printed to the log only (dev mode).
func (s *EmailSender) SendOTP(toEmail, code string) error {
	subject := "【可信房屋平台】Email 驗證碼"
	body := fmt.Sprintf(
		"您的驗證碼為：%s\n\n此驗證碼於 5 分鐘內有效，請勿將驗證碼分享給他人。",
		code,
	)

	if s.cfg.Host == "" {
		log.Printf("[notify/email] DEV MODE — to=%s code=%s", toEmail, code)
		return nil
	}

	msg := buildMIMEMessage(s.cfg.From, toEmail, subject, body)
	addr := s.cfg.Host + ":" + s.cfg.Port
	auth := smtp.PlainAuth("", s.cfg.User, s.cfg.Pass, s.cfg.Host)

	if err := smtp.SendMail(addr, auth, s.cfg.From, []string{toEmail}, []byte(msg)); err != nil {
		return fmt.Errorf("notify/email: send: %w", err)
	}
	return nil
}

func buildMIMEMessage(from, to, subject, body string) string {
	var sb strings.Builder
	sb.WriteString("From: " + from + "\r\n")
	sb.WriteString("To: " + to + "\r\n")
	sb.WriteString("Subject: " + subject + "\r\n")
	sb.WriteString("MIME-Version: 1.0\r\n")
	sb.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	sb.WriteString("\r\n")
	sb.WriteString(body)
	return sb.String()
}
