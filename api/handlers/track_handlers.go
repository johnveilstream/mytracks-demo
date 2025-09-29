package handlers

import (
	"net/http"
	"strconv"

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

	tracks, err := h.trackService.GetTracks(query, minDistance, maxDistance, minDuration, maxDuration)
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

func (h *TrackHandler) RefreshTracks(c *gin.Context) {
	count, err := h.trackService.RefreshTracksFromFiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tracks refreshed successfully",
		"count":   count,
	})
}

func (h *TrackHandler) DeleteTrack(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid track ID"})
		return
	}

	err = h.trackService.DeleteTrack(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Track deleted successfully"})
}
