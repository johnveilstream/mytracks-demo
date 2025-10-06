import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { GPXTrack } from '../types';
import { trackAPI } from '../api';

interface TrackRouteMapProps {
  track: GPXTrack;
}

// Component to fit the map to the track bounds
const MapController: React.FC<{ track: GPXTrack; trackPoints: Array<{ latitude: number; longitude: number }> }> = ({ track, trackPoints }) => {
  const map = useMap();

  useEffect(() => {
    if (trackPoints.length > 0) {
      // Calculate bounds from track points
      const lats = trackPoints.map(p => p.latitude);
      const lngs = trackPoints.map(p => p.longitude);
      
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
      
      // Fit map to track bounds with some padding
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, trackPoints]);

  return null;
};

const TrackRouteMap: React.FC<TrackRouteMapProps> = ({ track }) => {
  const [trackPoints, setTrackPoints] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrackPoints = async () => {
      try {
        setLoading(true);
        setError(null);
        const coordinates = await trackAPI.getTrackCoordinates([track.id]);
        const points = coordinates[track.id.toString()] || [];
        setTrackPoints(points);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load track points');
      } finally {
        setLoading(false);
      }
    };

    loadTrackPoints();
  }, [track.id]);

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        Loading track route...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        borderRadius: '8px',
        padding: '1rem'
      }}>
        Error loading track route: {error}
      </div>
    );
  }

  if (trackPoints.length === 0) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px'
      }}>
        No track points available
      </div>
    );
  }

  // Convert track points to polyline format
  const polylinePoints: [number, number][] = trackPoints.map(point => [point.latitude, point.longitude]);

  return (
    <div style={{ height: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        center={[track.bounds.north, track.bounds.east]} // Will be adjusted by MapController
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController track={track} trackPoints={trackPoints} />
        <Polyline
          positions={polylinePoints}
          color="#007bff"
          weight={4}
          opacity={0.8}
          pathOptions={{
            className: 'track-route-detail'
          }}
        />
      </MapContainer>
    </div>
  );
};

export default TrackRouteMap;
