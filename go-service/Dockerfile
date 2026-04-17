FROM golang:1.25 AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go env
RUN go mod download -x

# 在複製原始碼並編譯前，插入這個
ARG CACHEBUST=1
COPY . .

RUN go build -o server ./cmd/server

FROM debian:stable-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/server /app/server

EXPOSE 8081

CMD ["/app/server"]
