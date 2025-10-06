package main

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mytracks-api/handlers"
	"mytracks-api/models"
	"mytracks-api/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Rate limiter per IP address
type rateLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// Seeding progress tracking
type SeedingProgress struct {
	TotalTracks  int       `json:"total_tracks"`
	LoadedTracks int       `json:"loaded_tracks"`
	IsComplete   bool      `json:"is_complete"`
	IsRunning    bool      `json:"is_running"`
	ErrorMessage string    `json:"error_message,omitempty"`
	LastUpdated  time.Time `json:"last_updated"`
}

var (
	rateLimiters     = make(map[string]*rateLimiter)
	rateLimiterMutex sync.RWMutex

	// Seeding progress tracking
	seedingProgress = &SeedingProgress{
		TotalTracks:  0,
		LoadedTracks: 0,
		IsComplete:   false,
		IsRunning:    false,
		LastUpdated:  time.Now(),
	}
	seedingMutex sync.RWMutex
)

// CountGPXFilesInTar counts the number of .gpx files in a tar.gz archive
func countGPXFilesInTar(tarPath string) (int, error) {
	file, err := os.Open(tarPath)
	if err != nil {
		return 0, fmt.Errorf("failed to open tar file: %w", err)
	}
	defer file.Close()

	// Check if file is empty
	fileInfo, err := file.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to get file info: %w", err)
	}
	if fileInfo.Size() == 0 {
		return 0, fmt.Errorf("tar file is empty")
	}

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return 0, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	count := 0

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("error reading tar: %w", err)
		}

		if header.Typeflag == tar.TypeReg && strings.HasSuffix(strings.ToLower(header.Name), ".gpx") {
			count++
		}
	}

	return count, nil
}

// LoadTracksFromTar loads all GPX tracks from a tar.gz file into the database
func loadTracksFromTar(db *gorm.DB, tarPath string, gpxService *services.GPXService) error {
	file, err := os.Open(tarPath)
	if err != nil {
		return fmt.Errorf("failed to open tar file: %w", err)
	}
	defer file.Close()

	// Check if file is empty
	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %w", err)
	}
	if fileInfo.Size() == 0 {
		return fmt.Errorf("tar file is empty")
	}

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)
	loaded := 0

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("error reading tar: %w", err)
		}

		if header.Typeflag == tar.TypeReg && strings.HasSuffix(strings.ToLower(header.Name), ".gpx") {
			// Read the GPX file content
			gpxData := make([]byte, header.Size)
			_, err := io.ReadFull(tarReader, gpxData)
			if err != nil {
				log.Printf("Error reading GPX file %s: %v", header.Name, err)
				continue
			}

			// Parse the GPX data
			track, err := gpxService.ParseGPXData(gpxData, filepath.Base(header.Name))
			if err != nil {
				log.Printf("Error parsing GPX file %s: %v", header.Name, err)
				continue
			}

			// Check if track already exists
			var existingTrack models.GPXTrack
			result := db.Where("filename = ?", track.Filename).First(&existingTrack)
			if result.Error == nil {
				// Track already exists, skip
				log.Printf("Track %s already exists, skipping", track.Filename)
				loaded++
				updateSeedingProgress(loaded, seedingProgress.TotalTracks, false, "")
				continue
			}

			// Create the track in database
			if err := db.Create(track).Error; err != nil {
				log.Printf("Error creating track %s: %v", track.Filename, err)
				continue
			}

			loaded++
			updateSeedingProgress(loaded, seedingProgress.TotalTracks, false, "")

			// Log progress every 100 tracks
			if loaded%100 == 0 {
				log.Printf("Loaded %d/%d tracks...", loaded, seedingProgress.TotalTracks)
			}
		}
	}

	return nil
}

// updateSeedingProgress updates the seeding progress in a thread-safe manner
func updateSeedingProgress(loaded, total int, complete bool, errorMsg string) {
	seedingMutex.Lock()
	defer seedingMutex.Unlock()

	seedingProgress.LoadedTracks = loaded
	seedingProgress.TotalTracks = total
	seedingProgress.IsComplete = complete
	seedingProgress.IsRunning = !complete
	seedingProgress.ErrorMessage = errorMsg
	seedingProgress.LastUpdated = time.Now()
}

// getSeedingProgress returns the current seeding progress in a thread-safe manner
func getSeedingProgress() SeedingProgress {
	seedingMutex.RLock()
	defer seedingMutex.RUnlock()

	return *seedingProgress
}

// startSeedingProcess starts the background track loading process
func startSeedingProcess(db *gorm.DB, tarPath string) {
	go func() {
		log.Println("Starting track seeding process...")

		// Count total tracks in tar.gz
		totalTracks, err := countGPXFilesInTar(tarPath)
		if err != nil {
			log.Printf("Error counting tracks in tar.gz: %v", err)
			updateSeedingProgress(0, 0, false, fmt.Sprintf("Error counting tracks: %v", err))
			return
		}

		log.Printf("Found %d GPX files in tar.gz", totalTracks)

		// Check how many tracks are already in database
		var existingCount int64
		db.Model(&models.GPXTrack{}).Count(&existingCount)
		log.Printf("Found %d existing tracks in database", existingCount)

		// If we already have all tracks, mark as complete
		if int(existingCount) >= totalTracks {
			log.Println("All tracks already loaded, seeding complete")
			updateSeedingProgress(totalTracks, totalTracks, true, "")
			return
		}

		// Initialize progress tracking
		updateSeedingProgress(int(existingCount), totalTracks, false, "")

		// Load tracks from tar.gz
		gpxService := services.NewGPXService()
		err = loadTracksFromTar(db, tarPath, gpxService)
		if err != nil {
			log.Printf("Error loading tracks: %v", err)
			updateSeedingProgress(0, totalTracks, false, fmt.Sprintf("Error loading tracks: %v", err))
			return
		}

		// Mark as complete
		log.Println("Track seeding completed successfully")
		updateSeedingProgress(totalTracks, totalTracks, true, "")
	}()
}

// Clean up old rate limiters periodically
func cleanupRateLimiters() {
	for {
		time.Sleep(time.Minute)
		rateLimiterMutex.Lock()
		for ip, rl := range rateLimiters {
			if time.Since(rl.lastSeen) > time.Hour {
				delete(rateLimiters, ip)
			}
		}
		rateLimiterMutex.Unlock()
	}
}

// Get or create rate limiter for IP
func getRateLimiter(ip string) *rate.Limiter {
	rateLimiterMutex.Lock()
	defer rateLimiterMutex.Unlock()

	rl, exists := rateLimiters[ip]
	if !exists {
		// Allow 10 requests per second with burst of 20
		rateLimiters[ip] = &rateLimiter{
			limiter:  rate.NewLimiter(10, 20),
			lastSeen: time.Now(),
		}
		return rateLimiters[ip].limiter
	}

	rl.lastSeen = time.Now()
	return rl.limiter
}

// Rate limiting middleware
func rateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		limiter := getRateLimiter(ip)

		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": "Rate limit exceeded. Please slow down.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func main() {
	// Get configuration from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@postgres:5432/mytracks?sslmode=disable"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	gpxPath := "/app/data/gpx_files.tar.gz"
	if envPath := os.Getenv("GPX_PATH"); envPath != "" {
		gpxPath = envPath
	}

	s3URL := os.Getenv("GPX_S3_URL")
	if s3URL == "" {
		s3URL = "https://s3.us-west-2.amazonaws.com/app2.triptracks.io/gpx_files.tar.gz"
	}

	// Ensure GPX archive is available (download from S3 if needed)
	downloadService := services.NewDownloadService()
	if err := downloadService.EnsureGPXArchive(gpxPath, s3URL); err != nil {
		log.Fatal("Failed to ensure GPX archive availability:", err)
	}

	// Connect to database
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Auto-migrate the schema
	if err := models.AutoMigrate(db); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Initialize services
	trackService := services.NewTrackService(db, gpxPath)

	// Start background goroutine to populate missing geohashes
	go trackService.PopulateMissingGeohashes()

	// Start background cleanup for rate limiters
	go cleanupRateLimiters()

	// Start track seeding process
	startSeedingProcess(db, gpxPath)

	// Initialize handlers
	trackHandler := handlers.NewTrackHandler(trackService)

	// Setup Gin router
	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept", "X-Requested-With"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"}
	config.AllowCredentials = true
	config.ExposeHeaders = []string{"Content-Length", "Content-Type"}
	r.Use(cors.New(config))

	// Add explicit OPTIONS handler for preflight requests
	r.OPTIONS("/*path", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Length, Content-Type, Authorization, Accept, X-Requested-With")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Status(200)
	})

	// Add CORS debugging middleware
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		method := c.Request.Method
		path := c.Request.URL.Path

		// Log CORS requests for debugging
		if origin != "" {
			log.Printf("CORS request: %s %s from origin: %s", method, path, origin)
		}

		// Always set CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Length, Content-Type, Authorization, Accept, X-Requested-With")
		c.Header("Access-Control-Allow-Credentials", "true")

		if method == "OPTIONS" {
			c.Status(200)
			return
		}

		c.Next()
	})

	// Add rate limiting middleware
	r.Use(rateLimitMiddleware())

	// Add timeout middleware only for external operations (not database queries)
	r.Use(func(c *gin.Context) {
		// Only apply timeout to refresh endpoint which downloads from S3
		if c.Request.URL.Path == "/tracks/refresh" {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
			defer cancel()
			c.Request = c.Request.WithContext(ctx)
		}
		c.Next()
	})

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Environment variables endpoint
	r.GET("/env-vars", func(c *gin.Context) {
		envVars := make(map[string]string)
		for _, env := range os.Environ() {
			// Split on first '=' to handle values that contain '='
			parts := strings.SplitN(env, "=", 2)
			if len(parts) == 2 {
				envVars[parts[0]] = parts[1]
			}
		}
		c.JSON(200, gin.H{"environment_variables": envVars})
	})

	// Seeding progress endpoint
	r.GET("/seeding-progress", func(c *gin.Context) {
		progress := getSeedingProgress()
		c.JSON(200, progress)
	})

	// API routes
	api := r.Group("/")
	{
		// Track routes
		api.GET("/tracks", trackHandler.GetTracks)
		api.GET("/tracks/bounds", trackHandler.GetTracksByBounds)
		api.GET("/track_coordinates", trackHandler.GetTrackCoordinates)
		api.GET("/tracks/:id", trackHandler.GetTrack)
		api.GET("/tracks/:id/download", trackHandler.DownloadTrack)
	}

	// Start server
	log.Printf("Starting server on port %s", port)
	log.Printf("GPX files source: %s", gpxPath)
	if err := r.Run("0.0.0.0:" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
