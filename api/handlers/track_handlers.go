package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"mytracks-api/services"

	"github.com/gin-gonic/gin"
)

type TrackHandler struct {
	trackService *services.TrackService
}

func NewTrackHandler(trackService *services.TrackService) *TrackHandler {
	return &TrackHandler{
		trackService: trackService,
	}
}

func (h *TrackHandler) GetTracks(c *gin.Context) {
	// Parse query parameters
	query := c.Query("q")

	var minDistance, maxDistance *float64
	var minDuration, maxDuration *int
	var north, south, east, west *float64

	// Parse distance filters
	if minDistStr := c.Query("min_distance"); minDistStr != "" {
		if val, err := strconv.ParseFloat(minDistStr, 64); err == nil {
			minDistance = &val
		}
	}

	if maxDistStr := c.Query("max_distance"); maxDistStr != "" {
		if val, err := strconv.ParseFloat(maxDistStr, 64); err == nil {
			maxDistance = &val
		}
	}

	// Parse duration filters
	if minDurStr := c.Query("min_duration"); minDurStr != "" {
		if val, err := strconv.Atoi(minDurStr); err == nil {
			minDuration = &val
		}
	}

	if maxDurStr := c.Query("max_duration"); maxDurStr != "" {
		if val, err := strconv.Atoi(maxDurStr); err == nil {
			maxDuration = &val
		}
	}

	// Parse geographic bounds (optional)
	if northStr := c.Query("north"); northStr != "" {
		if val, err := strconv.ParseFloat(northStr, 64); err == nil {
			north = &val
		}
	}

	if southStr := c.Query("south"); southStr != "" {
		if val, err := strconv.ParseFloat(southStr, 64); err == nil {
			south = &val
		}
	}

	if eastStr := c.Query("east"); eastStr != "" {
		if val, err := strconv.ParseFloat(eastStr, 64); err == nil {
			east = &val
		}
	}

	if westStr := c.Query("west"); westStr != "" {
		if val, err := strconv.ParseFloat(westStr, 64); err == nil {
			west = &val
		}
	}

	// Parse limit (default to 1000)
	limit := 1000
	if limitStr := c.Query("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 {
			limit = val
		}
	}

	// Parse include_routes flag
	includeRoutes := c.Query("include_routes") == "true"

	// Use the enhanced method that supports geographic filtering
	tracks, err := h.trackService.GetTracksWithLocation(query, north, south, east, west, minDistance, maxDistance, minDuration, maxDuration, limit, includeRoutes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func (h *TrackHandler) GetTrack(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid track ID"})
		return
	}

	track, err := h.trackService.GetTrackByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Track not found"})
		return
	}

	c.JSON(http.StatusOK, track)
}

func (h *TrackHandler) GetTracksByBounds(c *gin.Context) {
	// Parse bounds parameters
	northStr := c.Query("north")
	southStr := c.Query("south")
	eastStr := c.Query("east")
	westStr := c.Query("west")

	if northStr == "" || southStr == "" || eastStr == "" || westStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing bounds parameters (north, south, east, west)"})
		return
	}

	north, err := strconv.ParseFloat(northStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid north coordinate"})
		return
	}

	south, err := strconv.ParseFloat(southStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid south coordinate"})
		return
	}

	east, err := strconv.ParseFloat(eastStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid east coordinate"})
		return
	}

	west, err := strconv.ParseFloat(westStr, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid west coordinate"})
		return
	}

	// Optional limit parameter (default 100, max 100)
	limit := 100
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsedLimit, err := strconv.Atoi(limitStr); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	tracks, err := h.trackService.GetTracksByBounds(north, south, east, west, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func (h *TrackHandler) GetTrackCoordinates(c *gin.Context) {
	// Parse the comma-separated list of track IDs
	idsParam := c.Query("ids")
	if idsParam == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing 'ids' parameter"})
		return
	}

	idStrings := strings.Split(idsParam, ",")
	var trackIDs []uint

	for _, idStr := range idStrings {
		idStr = strings.TrimSpace(idStr)
		if idStr == "" {
			continue
		}

		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid track ID: %s", idStr)})
			return
		}
		trackIDs = append(trackIDs, uint(id))
	}

	if len(trackIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No valid track IDs provided"})
		return
	}

	// Limit the number of tracks that can be requested at once
	if len(trackIDs) > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Too many track IDs requested (max 50)"})
		return
	}

	coordinates, err := h.trackService.GetTrackCoordinates(trackIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, coordinates)
}

func (h *TrackHandler) DownloadTrack(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid track ID"})
		return
	}

	gpxData, filename, err := h.trackService.GetGPXData(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Set headers for file download
	c.Header("Content-Type", "application/gpx+xml")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "application/gpx+xml", gpxData)
}
