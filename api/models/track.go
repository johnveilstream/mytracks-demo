package models

import (
	"time"

	"gorm.io/gorm"
)

type GPXTrack struct {
	ID            uint         `json:"id" gorm:"primaryKey"`
	Filename      string       `json:"filename" gorm:"uniqueIndex;not null"`
	Name          string       `json:"name"`
	Description   *string      `json:"description"`
	Distance      float64      `json:"distance"`       // in meters
	Duration      int          `json:"duration"`       // in seconds
	ElevationGain float64      `json:"elevation_gain"` // in meters
	ElevationLoss float64      `json:"elevation_loss"` // in meters
	MaxElevation  float64      `json:"max_elevation"`  // in meters
	MinElevation  float64      `json:"min_elevation"`  // in meters
	StartTime     *time.Time   `json:"start_time"`
	EndTime       *time.Time   `json:"end_time"`
	Bounds        Bounds       `json:"bounds" gorm:"embedded"`
	TrackPoints   []TrackPoint `json:"track_points" gorm:"foreignKey:TrackID"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
}

type Bounds struct {
	North float64 `json:"north"`
	South float64 `json:"south"`
	East  float64 `json:"east"`
	West  float64 `json:"west"`
}

type TrackPoint struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	TrackID   uint       `json:"track_id" gorm:"index"`
	Latitude  float64    `json:"latitude"`
	Longitude float64    `json:"longitude"`
	Elevation *float64   `json:"elevation"`
	Time      *time.Time `json:"time"`
	CreatedAt time.Time  `json:"created_at"`
}

func (GPXTrack) TableName() string {
	return "gpx_tracks"
}

func (TrackPoint) TableName() string {
	return "track_points"
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(&GPXTrack{}, &TrackPoint{})
}
