package config

import "os"

// ⭐ 共用環境變數讀取方法（全專案唯一入口）
func GetEnv(key string, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
