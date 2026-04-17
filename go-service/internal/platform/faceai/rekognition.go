package faceai

import (
	"bytes"
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/rekognition/types"
)

// RekognitionClient wraps AWS Rekognition for face similarity comparison.
type RekognitionClient struct {
	client *rekognition.Client
}

// NewRekognitionClient creates a client authenticated with explicit credentials.
// region example: "ap-northeast-1" (Tokyo) or "us-east-1"
func NewRekognitionClient(accessKeyID, secretAccessKey, region string) (*RekognitionClient, error) {
	cfg, err := awscfg.LoadDefaultConfig(context.Background(),
		awscfg.WithRegion(region),
		awscfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, ""),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("rekognition: load aws config: %w", err)
	}
	return &RekognitionClient{client: rekognition.NewFromConfig(cfg)}, nil
}

// CompareFaces sends both images to Rekognition and returns the similarity score
// (0.0 – 100.0).  sourceImage should be the ID card face crop; targetImage is
// the live selfie.
//
// Returns (0, nil) when Rekognition finds no faces to compare — the caller should
// treat this as a failed match rather than an error.
func (r *RekognitionClient) CompareFaces(ctx context.Context, sourceImage, targetImage []byte) (float32, error) {
	input := &rekognition.CompareFacesInput{
		SimilarityThreshold: aws.Float32(0), // return all matches regardless of score
		SourceImage: &types.Image{
			Bytes: bytes.Clone(sourceImage),
		},
		TargetImage: &types.Image{
			Bytes: bytes.Clone(targetImage),
		},
	}

	out, err := r.client.CompareFaces(ctx, input)
	if err != nil {
		return 0, fmt.Errorf("rekognition: compare faces: %w", err)
	}

	if len(out.FaceMatches) == 0 {
		// No face in source or no match found → treat as 0% similarity
		return 0, nil
	}

	// Return the highest similarity among all matches (usually just one)
	var best float32
	for _, m := range out.FaceMatches {
		if m.Similarity != nil && *m.Similarity > best {
			best = *m.Similarity
		}
	}
	return best, nil
}
