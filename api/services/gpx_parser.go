package services

import (
	"bytes"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"mytracks-api/models"

	"github.com/tkrajina/gpxgo/gpx"
)

type GPXService struct{}

func NewGPXService() *GPXService {
	return &GPXService{}
}

func (s *GPXService) ParseGPXFile(filename string) (*models.GPXTrack, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	gpxData, err := gpx.Parse(file)
	if err != nil {
		return nil, fmt.Errorf("failed to parse GPX: %w", err)
	}

	return s.processGPXData(gpxData, filepath.Base(filename))
}

func (s *GPXService) ParseGPXData(data []byte, filename string) (*models.GPXTrack, error) {
	reader := bytes.NewReader(data)
	
	gpxData, err := gpx.Parse(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse GPX: %w", err)
	}

	return s.processGPXData(gpxData, filename)
}

func (s *GPXService) processGPXData(gpxData *gpx.GPX, filename string) (*models.GPXTrack, error) {
	if len(gpxData.Tracks) == 0 {
		return nil, fmt.Errorf("no tracks found in GPX file")
	}

	// Use the first track
	track := gpxData.Tracks[0]
	
	// Create the track model
	gpxTrack := &models.GPXTrack{
		Filename:    filename,
		Name:        track.Name,
		TrackPoints: []models.TrackPoint{},
	}

	if track.Description != "" {
		gpxTrack.Description = &track.Description
	}

	// Initialize bounds
	var minLat, maxLat, minLon, maxLon float64
	var minEle, maxEle float64
	var totalDistance, totalElevationGain, totalElevationLoss float64
	var startTime, endTime *time.Time

	firstPoint := true
	var prevPoint *models.TrackPoint
	var prevElevation *float64

	// Process all track segments and points
	for _, segment := range track.Segments {
		for _, point := range segment.Points {
			trackPoint := models.TrackPoint{
				Latitude:  point.Latitude,
				Longitude: point.Longitude,
			}

			if point.Elevation.NotNull() {
				elevation := point.Elevation.Value()
				trackPoint.Elevation = &elevation
			}

			if !point.Timestamp.IsZero() {
				trackPoint.Time = &point.Timestamp
			}

			// Update bounds
			if firstPoint {
				minLat, maxLat = point.Latitude, point.Latitude
				minLon, maxLon = point.Longitude, point.Longitude
				if trackPoint.Elevation != nil {
					minEle, maxEle = *trackPoint.Elevation, *trackPoint.Elevation
				}
				if trackPoint.Time != nil {
					startTime = trackPoint.Time
					endTime = trackPoint.Time
				}
				firstPoint = false
			} else {
				if point.Latitude < minLat {
					minLat = point.Latitude
				}
				if point.Latitude > maxLat {
					maxLat = point.Latitude
				}
				if point.Longitude < minLon {
					minLon = point.Longitude
				}
				if point.Longitude > maxLon {
					maxLon = point.Longitude
				}

				if trackPoint.Elevation != nil {
					if *trackPoint.Elevation < minEle {
						minEle = *trackPoint.Elevation
					}
					if *trackPoint.Elevation > maxEle {
						maxEle = *trackPoint.Elevation
					}
				}

				if trackPoint.Time != nil {
					if startTime == nil || trackPoint.Time.Before(*startTime) {
						startTime = trackPoint.Time
					}
					if endTime == nil || trackPoint.Time.After(*endTime) {
						endTime = trackPoint.Time
					}
				}
			}

			// Calculate distance from previous point
			if prevPoint != nil {
				distance := haversineDistance(
					prevPoint.Latitude, prevPoint.Longitude,
					trackPoint.Latitude, trackPoint.Longitude,
				)
				totalDistance += distance
			}

			// Calculate elevation gain/loss
			if trackPoint.Elevation != nil && prevElevation != nil {
				elevationDiff := *trackPoint.Elevation - *prevElevation
				if elevationDiff > 0 {
					totalElevationGain += elevationDiff
				} else {
					totalElevationLoss += math.Abs(elevationDiff)
				}
			}

			gpxTrack.TrackPoints = append(gpxTrack.TrackPoints, trackPoint)
			prevPoint = &trackPoint
			if trackPoint.Elevation != nil {
				prevElevation = trackPoint.Elevation
			}
		}
	}

	// Set calculated values
	gpxTrack.Distance = totalDistance
	gpxTrack.ElevationGain = totalElevationGain
	gpxTrack.ElevationLoss = totalElevationLoss
	gpxTrack.MaxElevation = maxEle
	gpxTrack.MinElevation = minEle
	gpxTrack.StartTime = startTime
	gpxTrack.EndTime = endTime

	// Calculate duration
	if startTime != nil && endTime != nil {
		gpxTrack.Duration = int(endTime.Sub(*startTime).Seconds())
	}

	// Set bounds
	gpxTrack.Bounds = models.Bounds{
		North: maxLat,
		South: minLat,
		East:  maxLon,
		West:  minLon,
	}

	// If no name is provided, use filename without extension
	if gpxTrack.Name == "" {
		name := strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
		gpxTrack.Name = name
	}

	return gpxTrack, nil
}

// haversineDistance calculates the distance between two points on Earth
// using the Haversine formula. Returns distance in meters.
func haversineDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadius = 6371000 // Earth's radius in meters

	// Convert degrees to radians
	lat1Rad := lat1 * math.Pi / 180
	lon1Rad := lon1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lon2Rad := lon2 * math.Pi / 180

	// Calculate differences
	deltaLat := lat2Rad - lat1Rad
	deltaLon := lon2Rad - lon1Rad

	// Haversine formula
	a := math.Sin(deltaLat/2)*math.Sin(deltaLat/2) +
		math.Cos(lat1Rad)*math.Cos(lat2Rad)*
			math.Sin(deltaLon/2)*math.Sin(deltaLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadius * c
}
