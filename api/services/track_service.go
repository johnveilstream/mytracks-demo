package services

import (
	"fmt"
	"strings"

	"mytracks-api/models"

	"github.com/mmcloughlin/geohash"
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

	// Don't preload track points by default - too much data for list view
	db := s.db.Model(&models.GPXTrack{})

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

	err := db.Order("created_at DESC").Limit(1000).Find(&tracks).Error
	return tracks, err
}

// GetTracksWithLocation returns tracks with optional geographic filtering using geohash optimization
func (s *TrackService) GetTracksWithLocation(query string, north, south, east, west *float64, minDistance, maxDistance *float64, minDuration, maxDuration *int, limit int, includeRoutes bool) ([]models.GPXTrack, error) {
	var tracks []models.GPXTrack

	// Optionally preload track points for route display
	db := s.db.Model(&models.GPXTrack{})
	if includeRoutes {
		db = db.Preload("TrackPoints")
	}

	// Apply geographic filtering if bounds are provided
	if north != nil && south != nil && east != nil && west != nil {
		// Calculate geohashes for the corners of the search bounds
		topLeftHash := geohash.Encode(*north, *west)
		bottomRightHash := geohash.Encode(*south, *east)

		// Find the common prefix of the corner geohashes
		commonPrefix := findCommonPrefix(topLeftHash, bottomRightHash)

		// Use geohash prefix matching for initial filtering (much faster)
		if len(commonPrefix) > 0 {
			db = db.Where("geohash LIKE ?", commonPrefix+"%")
		}

		// Apply precise bounds checking
		db = db.Where(
			"north >= ? AND south <= ? AND east >= ? AND west <= ?",
			*south, *north, *west, *east,
		)
	}

	// Apply text search filters
	if query != "" {
		searchPattern := "%" + strings.ToLower(query) + "%"
		db = db.Where("LOWER(name) LIKE ? OR LOWER(filename) LIKE ? OR LOWER(description) LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	// Apply distance filters
	if minDistance != nil {
		db = db.Where("distance >= ?", *minDistance)
	}
	if maxDistance != nil {
		db = db.Where("distance <= ?", *maxDistance)
	}

	// Apply duration filters
	if minDuration != nil {
		db = db.Where("duration >= ?", *minDuration)
	}
	if maxDuration != nil {
		db = db.Where("duration <= ?", *maxDuration)
	}

	// Order by creation date (newest first) and apply limit
	err := db.Order("created_at DESC").Limit(limit).Find(&tracks).Error
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

func (s *TrackService) GetTracksByBounds(north, south, east, west float64, limit int) ([]models.GPXTrack, error) {
	var tracks []models.GPXTrack

	// Calculate geohashes for the corners of the search bounds
	topLeftHash := geohash.Encode(north, west)
	bottomRightHash := geohash.Encode(south, east)

	// Find the common prefix of the corner geohashes
	// This gives us the geohash precision that covers the search area
	commonPrefix := findCommonPrefix(topLeftHash, bottomRightHash)

	// Use geohash prefix matching for initial filtering (much faster)
	// Then apply precise bounds checking as a secondary filter
	// DON'T preload track points for bounds queries - too much data
	query := s.db.Model(&models.GPXTrack{})

	if len(commonPrefix) > 0 {
		// Use geohash prefix for fast initial filtering
		query = query.Where("geohash LIKE ?", commonPrefix+"%")
	}

	// Apply precise bounds checking
	query = query.Where(
		"north >= ? AND south <= ? AND east >= ? AND west <= ?",
		south, north, west, east,
	).Limit(limit).Order("created_at DESC")

	err := query.Find(&tracks).Error
	return tracks, err
}

// findCommonPrefix finds the longest common prefix between two geohashes
func findCommonPrefix(hash1, hash2 string) string {
	minLen := len(hash1)
	if len(hash2) < minLen {
		minLen = len(hash2)
	}

	var prefix strings.Builder
	for i := 0; i < minLen; i++ {
		if hash1[i] == hash2[i] {
			prefix.WriteByte(hash1[i])
		} else {
			break
		}
	}

	// Ensure we have a meaningful prefix (at least 2 characters for reasonable geographic area)
	result := prefix.String()
	if len(result) < 2 {
		return ""
	}

	return result
}

func (s *TrackService) PopulateMissingGeohashes() {
	log := fmt.Printf // Use fmt.Printf for logging in this goroutine

	log("Starting background geohash population task...\n")

	// Find tracks with empty geohash
	var tracks []models.GPXTrack
	err := s.db.Where("geohash = '' OR geohash IS NULL").Find(&tracks).Error
	if err != nil {
		log("Error finding tracks with missing geohash: %v\n", err)
		return
	}

	if len(tracks) == 0 {
		log("All tracks already have geohash values\n")
		return
	}

	log("Found %d tracks missing geohash values, updating...\n", len(tracks))

	// Process tracks in batches to avoid overwhelming the database
	batchSize := 100
	updated := 0

	for i := 0; i < len(tracks); i += batchSize {
		end := i + batchSize
		if end > len(tracks) {
			end = len(tracks)
		}

		batch := tracks[i:end]

		// Update each track in the batch
		for _, track := range batch {
			// Calculate centroid from bounds
			centroidLat := (track.Bounds.North + track.Bounds.South) / 2
			centroidLon := (track.Bounds.East + track.Bounds.West) / 2

			// Generate geohash
			trackGeohash := geohash.Encode(centroidLat, centroidLon)

			// Update the track
			err := s.db.Model(&track).Update("geohash", trackGeohash).Error
			if err != nil {
				log("Error updating geohash for track %d: %v\n", track.ID, err)
				continue
			}

			updated++
		}

		// Log progress every 1000 tracks
		if updated%1000 == 0 {
			log("Updated geohash for %d/%d tracks...\n", updated, len(tracks))
		}
	}

	log("Completed geohash population: updated %d tracks\n", updated)
}

// Simplified track point structure for coordinates endpoint
type TrackCoordinate struct {
	Latitude  float64  `json:"latitude"`
	Longitude float64  `json:"longitude"`
	Elevation *float64 `json:"elevation"`
}

func (s *TrackService) GetTrackCoordinates(trackIDs []uint) (map[uint][]TrackCoordinate, error) {
	var trackPoints []models.TrackPoint

	// Query only the fields we need: track_id, latitude, longitude, elevation
	err := s.db.Select("track_id, latitude, longitude, elevation").Where("track_id IN ?", trackIDs).Find(&trackPoints).Error
	if err != nil {
		return nil, err
	}

	// Group track points by track ID and convert to simplified structure
	result := make(map[uint][]TrackCoordinate)
	for _, point := range trackPoints {
		coord := TrackCoordinate{
			Latitude:  point.Latitude,
			Longitude: point.Longitude,
			Elevation: point.Elevation,
		}
		result[point.TrackID] = append(result[point.TrackID], coord)
	}

	return result, nil
}

func (s *TrackService) GetGPXData(id uint) ([]byte, string, error) {
	// Get track with all points
	var track models.GPXTrack
	err := s.db.Preload("TrackPoints").First(&track, id).Error
	if err != nil {
		return nil, "", err
	}

	// Generate GPX XML
	gpxXML := s.generateGPX(track)
	filename := track.Filename
	if filename == "" {
		filename = fmt.Sprintf("track_%d.gpx", id)
	}

	return []byte(gpxXML), filename, nil
}

func (s *TrackService) generateGPX(track models.GPXTrack) string {
	var gpx strings.Builder

	gpx.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	gpx.WriteString(`<gpx version="1.1" creator="MyTracks" xmlns="http://www.topografix.com/GPX/1/1">`)

	// Track metadata
	if track.Name != "" {
		gpx.WriteString(fmt.Sprintf(`<name>%s</name>`, track.Name))
	}
	if track.Description != nil && *track.Description != "" {
		gpx.WriteString(fmt.Sprintf(`<desc>%s</desc>`, *track.Description))
	}

	// Track segment
	gpx.WriteString(`<trk>`)
	if track.Name != "" {
		gpx.WriteString(fmt.Sprintf(`<name>%s</name>`, track.Name))
	}

	gpx.WriteString(`<trkseg>`)

	// Add track points
	for _, point := range track.TrackPoints {
		gpx.WriteString(`<trkpt lat="`)
		gpx.WriteString(fmt.Sprintf("%.6f", point.Latitude))
		gpx.WriteString(`" lon="`)
		gpx.WriteString(fmt.Sprintf("%.6f", point.Longitude))
		gpx.WriteString(`">`)

		if point.Elevation != nil {
			gpx.WriteString(fmt.Sprintf(`<ele>%.2f</ele>`, *point.Elevation))
		}

		if point.Time != nil {
			gpx.WriteString(fmt.Sprintf(`<time>%s</time>`, point.Time.Format("2006-01-02T15:04:05Z")))
		}

		gpx.WriteString(`</trkpt>`)
	}

	gpx.WriteString(`</trkseg>`)
	gpx.WriteString(`</trk>`)
	gpx.WriteString(`</gpx>`)

	return gpx.String()
}
