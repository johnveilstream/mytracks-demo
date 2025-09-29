package services

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"mytracks-api/models"

	"gorm.io/gorm"
)

type TrackService struct {
	db         *gorm.DB
	gpxService *GPXService
	gpxPath    string // Can be either a directory or tar.gz file
}

func NewTrackService(db *gorm.DB, gpxPath string) *TrackService {
	return &TrackService{
		db:         db,
		gpxService: NewGPXService(),
		gpxPath:    gpxPath,
	}
}

func (s *TrackService) GetTracks(query string, minDistance, maxDistance *float64, minDuration, maxDuration *int) ([]models.GPXTrack, error) {
	var tracks []models.GPXTrack

	db := s.db.Preload("TrackPoints")

	// Apply search filters
	if query != "" {
		searchPattern := "%" + strings.ToLower(query) + "%"
		db = db.Where("LOWER(name) LIKE ? OR LOWER(filename) LIKE ? OR LOWER(description) LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	if minDistance != nil {
		db = db.Where("distance >= ?", *minDistance)
	}

	if maxDistance != nil {
		db = db.Where("distance <= ?", *maxDistance)
	}

	if minDuration != nil {
		db = db.Where("duration >= ?", *minDuration)
	}

	if maxDuration != nil {
		db = db.Where("duration <= ?", *maxDuration)
	}

	err := db.Order("created_at DESC").Find(&tracks).Error
	return tracks, err
}

func (s *TrackService) GetTrackByID(id uint) (*models.GPXTrack, error) {
	var track models.GPXTrack
	err := s.db.Preload("TrackPoints").First(&track, id).Error
	if err != nil {
		return nil, err
	}
	return &track, nil
}

func (s *TrackService) RefreshTracksFromFiles() (int, error) {
	// Check if gpxPath is a tar.gz file or directory
	if strings.HasSuffix(strings.ToLower(s.gpxPath), ".tar.gz") {
		return s.refreshFromArchive()
	} else {
		return s.refreshFromDirectory()
	}
}

func (s *TrackService) refreshFromArchive() (int, error) {
	file, err := os.Open(s.gpxPath)
	if err != nil {
		return 0, fmt.Errorf("failed to open archive: %w", err)
	}
	defer file.Close()

	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return 0, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	processed := 0

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return processed, fmt.Errorf("error reading tar: %w", err)
		}

		// Skip directories and non-GPX files
		if header.Typeflag != tar.TypeReg || !strings.HasSuffix(strings.ToLower(header.Name), ".gpx") {
			continue
		}

		filename := filepath.Base(header.Name)
		
		// Check if this file is already in the database
		var existingTrack models.GPXTrack
		err = s.db.Where("filename = ?", filename).First(&existingTrack).Error

		if err == gorm.ErrRecordNotFound {
			// File not in database, parse and add it
			gpxData := make([]byte, header.Size)
			_, err := io.ReadFull(tarReader, gpxData)
			if err != nil {
				fmt.Printf("Failed to read %s from archive: %v\n", filename, err)
				continue
			}

			track, parseErr := s.gpxService.ParseGPXData(gpxData, filename)
			if parseErr != nil {
				fmt.Printf("Failed to parse %s: %v\n", filename, parseErr)
				continue
			}

			// Save to database
			if err := s.db.Create(track).Error; err != nil {
				fmt.Printf("Failed to save track %s: %v\n", filename, err)
				continue
			}

			processed++
		} else if err != nil {
			fmt.Printf("Database error checking %s: %v\n", filename, err)
			continue
		}
		// If no error, file already exists in database, skip it
	}

	return processed, nil
}

func (s *TrackService) refreshFromDirectory() (int, error) {
	// Get all GPX files in the directory
	gpxFiles, err := s.findGPXFiles()
	if err != nil {
		return 0, fmt.Errorf("failed to find GPX files: %w", err)
	}

	processed := 0
	for _, file := range gpxFiles {
		// Check if this file is already in the database
		var existingTrack models.GPXTrack
		err := s.db.Where("filename = ?", filepath.Base(file)).First(&existingTrack).Error

		if err == gorm.ErrRecordNotFound {
			// File not in database, parse and add it
			track, parseErr := s.gpxService.ParseGPXFile(file)
			if parseErr != nil {
				fmt.Printf("Failed to parse %s: %v\n", file, parseErr)
				continue
			}

			// Save to database
			if err := s.db.Create(track).Error; err != nil {
				fmt.Printf("Failed to save track %s: %v\n", file, err)
				continue
			}

			processed++
		} else if err != nil {
			fmt.Printf("Database error checking %s: %v\n", file, err)
			continue
		}
		// If no error, file already exists in database, skip it
	}

	return processed, nil
}

func (s *TrackService) findGPXFiles() ([]string, error) {
	var gpxFiles []string

	err := filepath.Walk(s.gpxPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !info.IsDir() && strings.ToLower(filepath.Ext(path)) == ".gpx" {
			gpxFiles = append(gpxFiles, path)
		}

		return nil
	})

	return gpxFiles, err
}

func (s *TrackService) DeleteTrack(id uint) error {
	// Delete track points first (due to foreign key constraint)
	if err := s.db.Where("track_id = ?", id).Delete(&models.TrackPoint{}).Error; err != nil {
		return err
	}

	// Delete the track
	return s.db.Delete(&models.GPXTrack{}, id).Error
}
