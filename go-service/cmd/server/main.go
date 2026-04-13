package main

import (
	"context"
	"log"
	"os"
	"os/signal"
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

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
