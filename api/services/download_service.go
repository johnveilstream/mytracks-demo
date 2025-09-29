package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

type DownloadService struct {
	client *http.Client
}

func NewDownloadService() *DownloadService {
	return &DownloadService{
		client: &http.Client{
			Timeout: 10 * time.Minute, // Long timeout for large file downloads
		},
	}
}

// DownloadFile downloads a file from the given URL and saves it to the specified path
func (s *DownloadService) DownloadFile(url, filePath string) error {
	// Create the directory if it doesn't exist
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Check if file already exists
	if _, err := os.Stat(filePath); err == nil {
		fmt.Printf("File %s already exists, skipping download\n", filePath)
		return nil
	}

	fmt.Printf("Downloading %s to %s...\n", url, filePath)
	
	// Create HTTP request
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("User-Agent", "MyTracks-API/1.0")

	// Make the request
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d %s", resp.StatusCode, resp.Status)
	}

	// Create the file
	out, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create file: %w", err)
	}
	defer out.Close()

	// Copy the response body to file
	bytesWritten, err := io.Copy(out, resp.Body)
	if err != nil {
		// Clean up partial file on error
		os.Remove(filePath)
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("Successfully downloaded %d bytes to %s\n", bytesWritten, filePath)
	return nil
}

// EnsureGPXArchive ensures the GPX archive exists, downloading it from S3 if necessary
func (s *DownloadService) EnsureGPXArchive(archivePath, s3URL string) error {
	// Check if the archive already exists
	if _, err := os.Stat(archivePath); err == nil {
		fmt.Printf("GPX archive already exists at %s\n", archivePath)
		return nil
	}

	// Download from S3
	fmt.Printf("GPX archive not found locally, downloading from S3...\n")
	return s.DownloadFile(s3URL, archivePath)
}
