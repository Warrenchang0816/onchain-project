package blockchain

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// DeedHash 計算房產所有權狀的 SHA-256 雜湊值。
// 輸入：所有權狀文件的原始位元組。
// 返回：bytes32 格式的十六進位字串（不含 0x 前綴），用於合約參數。
func DeedHash(deedData []byte) [32]byte {
	return sha256.Sum256(deedData)
}

// DisclosureHash 計算現況說明書的 SHA-256 雜湊值。
// 輸入：現況說明書的結構化資料（建議先序列化為 JSON 或其他穩定格式）。
func DisclosureHash(disclosureData []byte) [32]byte {
	return sha256.Sum256(disclosureData)
}

// IdentityHash 計算身份資訊的 SHA-256 雜湊值。
// 輸入：TWID 提供的身份識別資料（PII 僅在此函式內短暫存在）。
// 注意：平台不儲存原始 PII，只儲存此 hash 用於去重複驗證。
func IdentityHash(identityData []byte) [32]byte {
	return sha256.Sum256(identityData)
}

// HashToHex 將 [32]byte 轉為不含 0x 前綴的十六進位字串。
// 用於 DB 儲存（VARCHAR(64)）。
func HashToHex(h [32]byte) string {
	return hex.EncodeToString(h[:])
}

// HashToBytes32Hex 將 [32]byte 轉為含 0x 前綴的十六進位字串。
// 用於 Ethereum bytes32 型別（合約呼叫、ABI 編碼）。
func HashToBytes32Hex(h [32]byte) string {
	return "0x" + hex.EncodeToString(h[:])
}

// HexToBytes32 將十六進位字串（含或不含 0x 前綴）解析為 [32]byte。
// 用於從 DB 讀取後還原為合約參數型別。
func HexToBytes32(s string) ([32]byte, error) {
	s = strings.TrimPrefix(s, "0x")
	if len(s) != 64 {
		return [32]byte{}, fmt.Errorf("blockchain: invalid bytes32 hex length %d (expected 64)", len(s))
	}

	b, err := hex.DecodeString(s)
	if err != nil {
		return [32]byte{}, fmt.Errorf("blockchain: invalid bytes32 hex: %w", err)
	}

	var result [32]byte
	copy(result[:], b)
	return result, nil
}

// HashFields 將多個字串欄位組合後計算 SHA-256。
// 用於需要對多個欄位做聯合雜湊的場景（如現況說明書的結構化欄位）。
// 欄位間以 "\x00" 分隔，避免串接歧義（"ab"+"c" vs "a"+"bc"）。
func HashFields(fields ...string) [32]byte {
	combined := strings.Join(fields, "\x00")
	return sha256.Sum256([]byte(combined))
}
