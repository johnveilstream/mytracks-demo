import React, { useState, useMemo } from 'react';
import { GPXTrack, SearchFilters } from '../types';

interface TrackListProps {
  tracks: GPXTrack[];
  selectedTrack: GPXTrack | null;
  onTrackSelect: (track: GPXTrack) => void;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const TrackList: React.FC<TrackListProps> = ({
  tracks,
  selectedTrack,
  onTrackSelect,
  loading,
  error,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return tracks;
    
    const query = searchQuery.toLowerCase();
    return tracks.filter(track => 
      track.name.toLowerCase().includes(query) ||
      track.filename.toLowerCase().includes(query) ||
      (track.description && track.description.toLowerCase().includes(query))
    );
  }, [tracks, searchQuery]);

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
          <button onClick={onRefresh} style={{ marginLeft: '1rem' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search tracks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          onClick={onRefresh}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh Tracks'}
        </button>
      </div>

      {loading && (
        <div className="loading">Loading tracks...</div>
      )}

      <ul className="track-list">
        {filteredTracks.map((track) => (
          <li
            key={track.id}
            className={`track-item ${selectedTrack?.id === track.id ? 'selected' : ''}`}
            onClick={() => onTrackSelect(track)}
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

      {!loading && filteredTracks.length === 0 && (
        <div className="loading">
          {searchQuery ? 'No tracks match your search.' : 'No tracks found. Click "Refresh Tracks" to scan for GPX files.'}
        </div>
      )}
    </div>
  );
};

export default TrackList;
