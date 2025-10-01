package main

import (
	"context"
	"log"
	"net/http"
	"os"
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

var (
	rateLimiters     = make(map[string]*rateLimiter)
	rateLimiterMutex sync.RWMutex
)

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
		databaseURL = "postgres://postgres:postgres@localhost:5432/mytracks?sslmode=disable"
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
