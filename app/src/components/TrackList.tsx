import React from 'react';
import { GPXTrack } from '../types';

interface TrackListProps {
  tracks: GPXTrack[];
  selectedTrack: GPXTrack | null;
  onTrackSelect: (track: GPXTrack) => void;
  onTrackClick?: (track: GPXTrack) => void;
  loading: boolean;
  error: string | null;
}

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  onTrackClick,
  loading,
  error,
}) => {

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatElevation = (meters: number): string => {
    return `${Math.round(meters)}m`;
  };

  if (error) {
    return (
      <div className="sidebar">
        <div className="error">
          Error loading tracks: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      {loading && (
        <div className="loading">Loading tracks...</div>
      )}

      <ul className="track-list">
        {tracks.map((track) => (
          <li
            key={track.id}
            className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
            onClick={() => onTrackSelect(track)}
            onDoubleClick={() => onTrackClick && onTrackClick(track)}
            style={{ cursor: 'pointer' }}
          >
            <div className="track-name">{track.name || track.filename}</div>
            <div className="track-meta">
              <div>{formatDistance(track.distance)} • {formatDuration(track.duration)}</div>
              <div>↗ {formatElevation(track.elevation_gain)} • ↘ {formatElevation(track.elevation_loss)}</div>
              <div>Max: {formatElevation(track.max_elevation)} • Min: {formatElevation(track.min_elevation)}</div>
              {track.description && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  {track.description}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!loading && tracks.length === 0 && (
        <div className="loading">
          No tracks found in this area. Try moving the map to explore different regions.
        </div>
      )}
    </div>
  );
};

export default TrackList;
