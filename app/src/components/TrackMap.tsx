import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { GPXTrack } from '../types';

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
  const defaultCenter: [number, number] = [40.7128, -74.0060]; // New York
  const defaultZoom = 10;

  const trackPoints = selectedTrack?.track_points.map(point => [
    point.latitude,
    point.longitude
  ] as [number, number]) || [];

  return (
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
  );
};

export default TrackMap;
