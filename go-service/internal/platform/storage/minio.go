package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client wraps MinIO with the operations needed by the KYC module.
type Client struct {
	mc     *minio.Client
	bucket string
}

// NewClient connects to MinIO and ensures the KYC bucket exists.
func NewClient(endpoint, accessKey, secretKey, bucket string, useSSL bool) (*Client, error) {
	mc, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio: new client: %w", err)
	}

	ctx := context.Background()
	exists, err := mc.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("minio: check bucket: %w", err)
	}
	if !exists {
		if err := mc.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("minio: create bucket %q: %w", bucket, err)
		}
		log.Printf("[minio] bucket %q created", bucket)
	}

	log.Printf("[minio] connected to %s, bucket=%s", endpoint, bucket)
	return &Client{mc: mc, bucket: bucket}, nil
}

// Upload stores data at objectPath and returns the path.
func (c *Client) Upload(ctx context.Context, objectPath string, data []byte, contentType string) error {
	_, err := c.mc.PutObject(ctx, c.bucket, objectPath, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		return fmt.Errorf("minio: upload %s: %w", objectPath, err)
	}
	return nil
}

// Download retrieves an object and returns its bytes.
func (c *Client) Download(ctx context.Context, objectPath string) ([]byte, error) {
	obj, err := c.mc.GetObject(ctx, c.bucket, objectPath, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("minio: get %s: %w", objectPath, err)
	}
	defer obj.Close()

	data, err := io.ReadAll(obj)
	if err != nil {
		return nil, fmt.Errorf("minio: read %s: %w", objectPath, err)
	}
	return data, nil
}
