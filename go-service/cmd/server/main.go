package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"go-service/internal/bootstrap"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	r, cleanup, err := bootstrap.Wire(ctx)
	if err != nil {
		log.Fatalf("failed to wire application: %v", err)
	}
	defer cleanup()

	port := strings.TrimSpace(os.Getenv("APP_PORT"))
	if port == "" {
		port = "8081"
	}

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
