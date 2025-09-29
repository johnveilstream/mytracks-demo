import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { GPXTrack } from '../types';
import { useGeolocation } from '../hooks/useGeolocation';

interface TrackMapProps {
  selectedTrack: GPXTrack | null;
}

const MapController: React.FC<{ track: GPXTrack | null }> = ({ track }) => {
  const map = useMap();

  useEffect(() => {
    if (track && track.track_points.length > 0) {
      const bounds = new LatLngBounds(
        [track.bounds.south, track.bounds.west],
        [track.bounds.north, track.bounds.east]
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, track]);

  return null;
};

const TrackMap: React.FC<TrackMapProps> = ({ selectedTrack }) => {
  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();
  
  // Use user's location if available, otherwise fallback to New York
  const defaultCenter: [number, number] = 
    latitude && longitude ? [latitude, longitude] : [40.7128, -74.0060];
  const defaultZoom = 10;

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
      
      {locationError && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(255, 235, 235, 0.9)',
          color: '#d63031',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          ⚠️ {locationError}
        </div>
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
        
        {selectedTrack && trackPoints.length > 0 && (
          <>
            <Polyline
              positions={trackPoints}
              color="#007bff"
              weight={4}
              opacity={0.8}
            />
            <MapController track={selectedTrack} />
          </>
        )}
      </MapContainer>
    </div>
  );
};

export default TrackMap;
