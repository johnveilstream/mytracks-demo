import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { GPXTrack } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';
import { trackAPI } from '../api';

interface TrackMapProps {
  tracks: GPXTrack[];
  selectedTrack: GPXTrack | null;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  onTrackClick?: (track: GPXTrack) => void;
}

const MapController: React.FC<{ 
  track: GPXTrack | null;
  userLocation: { lat: number; lng: number } | null;
  hasInitializedLocation: boolean;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}> = ({ track, userLocation, hasInitializedLocation, onViewportChange }) => {
  const map = useMap();

  // Center map on user location when first obtained
  useEffect(() => {
    if (userLocation && !hasInitializedLocation && !track) {
      map.setView([userLocation.lat, userLocation.lng], 13);
    }
  }, [map, userLocation, hasInitializedLocation, track]);

  // Fit bounds for selected track
  useEffect(() => {
    if (track && track.track_points.length > 0) {
      const bounds = new LatLngBounds(
        [track.bounds.south, track.bounds.west],
        [track.bounds.north, track.bounds.east]
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, track]);

  // Handle viewport changes (move, zoom)
  useEffect(() => {
    if (!onViewportChange) return;

    const handleViewportChange = () => {
      const bounds = map.getBounds();
      const viewportBounds = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      };
      onViewportChange(viewportBounds);
    };

    // Initial load
    map.whenReady(() => {
      handleViewportChange();
    });

    // Listen for map events
    map.on('moveend', handleViewportChange);
    map.on('zoomend', handleViewportChange);

    return () => {
      map.off('moveend', handleViewportChange);
      map.off('zoomend', handleViewportChange);
    };
  }, [map, onViewportChange]);

  return null;
};

const TrackMap: React.FC<TrackMapProps> = ({ tracks, selectedTrack, onViewportChange, onTrackClick }) => {
  const { coords, status, error: locationError, getOnce } = useGeolocation({
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 60000
  });
  const [hasInitializedLocation, setHasInitializedLocation] = React.useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);
  const [trackCoordinates, setTrackCoordinates] = useState<Record<string, Array<{ latitude: number; longitude: number; elevation?: number }>>>({});
  
  // Use user's location if available, otherwise fallback to New York
  const defaultCenter: [number, number] = [40.7128, -74.0060]; // Always start with fallback
  const defaultZoom = 10;
  
  const userLocation = coords ? { lat: coords.latitude, lng: coords.longitude } : null;
  const locationLoading = status === "prompt";
  const requestLocation = getOnce;
  
  // Auto-request location on mount
  React.useEffect(() => {
    if (status === "idle") {
      getOnce();
    }
  }, [status, getOnce]);

  // Fetch track coordinates when tracks change
  React.useEffect(() => {
    if (tracks.length > 0) {
      const trackIds = tracks.map(track => track.id);
      trackAPI.getTrackCoordinates(trackIds)
        .then(coordinates => {
          setTrackCoordinates(coordinates);
        })
        .catch(error => {
          console.error('Failed to fetch track coordinates:', error);
          setTrackCoordinates({});
        });
    } else {
      setTrackCoordinates({});
    }
  }, [tracks]);
  
  // Track when we've successfully centered on user location
  React.useEffect(() => {
    if (userLocation && !hasInitializedLocation) {
      setHasInitializedLocation(true);
      setShowSuccessMessage(true);
      
      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [userLocation, hasInitializedLocation]);

  const trackPoints = selectedTrack?.track_points.map(point => [
    point.latitude,
    point.longitude
  ] as [number, number]) || [];

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {locationLoading && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          📍 Getting your location...
        </div>
      )}
      
      {locationError && status !== "prompt" && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255, 235, 235, 0.95)',
          color: '#d63031',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          maxWidth: '300px'
        }}>
          ⚠️ {locationError}
          {(locationError.includes('Timeout') || locationError.includes('timed out')) && (
            <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
              Try the "Get My Location" button for a manual retry
            </div>
          )}
          {locationError.includes('Permission denied') && (
            <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
              Please enable location access in your browser settings
            </div>
          )}
        </div>
      )}
      
      {showSuccessMessage && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(235, 255, 235, 0.9)',
          color: '#00b894',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          ✓ Map centered on your location
        </div>
      )}
      
      {!userLocation && status !== "prompt" && (
        <button
          onClick={requestLocation}
          disabled={locationLoading}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: locationLoading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: locationLoading ? 'not-allowed' : 'pointer',
            zIndex: 1000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: locationLoading ? 0.7 : 1
          }}
          onMouseOver={(e) => {
            if (!locationLoading) {
              e.currentTarget.style.background = '#0056b3';
            }
          }}
          onMouseOut={(e) => {
            if (!locationLoading) {
              e.currentTarget.style.background = '#007bff';
            }
          }}
        >
          {locationLoading ? '⏳ Getting Location...' : '📍 Get My Location'}
        </button>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController 
          track={selectedTrack} 
          userLocation={userLocation}
          hasInitializedLocation={hasInitializedLocation}
          onViewportChange={onViewportChange}
        />
        
        {/* Render all tracks in the viewport with vertex budget */}
        {(() => {
          const MAX_TOTAL_VERTICES = 5000;
          const tracksWithCoordinates = tracks.filter(track => trackCoordinates[track.id.toString()]);
          
          if (tracksWithCoordinates.length === 0) return null;
          
          // Calculate vertex budget per track
          const vertexBudgetPerTrack = Math.floor(MAX_TOTAL_VERTICES / tracksWithCoordinates.length);
          
          console.log(`Rendering ${tracksWithCoordinates.length} tracks with ${vertexBudgetPerTrack} vertices each (${MAX_TOTAL_VERTICES} total budget)`);
          
          return tracksWithCoordinates.map((track) => {
            const allPoints = trackCoordinates[track.id.toString()];
            if (!allPoints || allPoints.length === 0) return null;
            
            let trackPoints: [number, number][];
            
            // Subsample points if track exceeds its vertex budget
            if (allPoints.length > vertexBudgetPerTrack) {
              const step = Math.ceil(allPoints.length / vertexBudgetPerTrack);
              trackPoints = allPoints
                .filter((_, index) => index % step === 0)
                .map(point => [point.latitude, point.longitude] as [number, number]);
            } else {
              trackPoints = allPoints.map(point => [point.latitude, point.longitude] as [number, number]);
            }
            
            const isSelected = selectedTrack && selectedTrack.id === track.id;
            
            return (
              <Polyline
                key={track.id}
                positions={trackPoints}
                color={isSelected ? "#007bff" : "#ff6b6b"}
                weight={isSelected ? 8 : 5}
                opacity={isSelected ? 0.9 : 0.7}
                pathOptions={{
                  className: isSelected ? 'selected-track' : 'track-route'
                }}
                eventHandlers={{
                  click: () => {
                    if (onTrackClick) {
                      onTrackClick(track);
                    }
                  }
                }}
              />
            );
          });
        })()}
      </MapContainer>
    </div>
  );
};

export default TrackMap;
