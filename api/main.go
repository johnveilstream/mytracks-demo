package main

import (
	"log"
	"os"

	"mytracks-api/handlers"
	"mytracks-api/models"
	"mytracks-api/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

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

	gpxPath := "/app/gpx_files.tar.gz"
	if envPath := os.Getenv("GPX_PATH"); envPath != "" {
		gpxPath = envPath
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

	// Initialize handlers
	trackHandler := handlers.NewTrackHandler(trackService)

	// Setup Gin router
	r := gin.Default()

	// Configure CORS
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	r.Use(cors.New(config))

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API routes
	api := r.Group("/")
	{
		// Track routes
		api.GET("/tracks", trackHandler.GetTracks)
		api.GET("/tracks/:id", trackHandler.GetTrack)
		api.POST("/tracks/refresh", trackHandler.RefreshTracks)
		api.DELETE("/tracks/:id", trackHandler.DeleteTrack)
	}

	// Start server
	log.Printf("Starting server on port %s", port)
	log.Printf("GPX files source: %s", gpxPath)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
