import React, { useState } from 'react';
import { GPXTrack } from '../types';
import TrackRouteMap from './TrackRouteMap';
import { trackAPI } from '../api';

interface TrackDetailsProps {
  track: GPXTrack;
  onBack: () => void;
}

const TrackDetails: React.FC<TrackDetailsProps> = ({ track, onBack }) => {
  const [downloading, setDownloading] = useState(false);

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

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await trackAPI.downloadGPX(track.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${track.filename || track.name || 'track'}.gpx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download GPX file:', error);
      alert('Failed to download GPX file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="track-details-layout">
      <div className="track-details-content">
        <div className="track-details-header">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <button 
              onClick={onBack}
              className="back-button"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ← Back to Map
            </button>
            <button 
              onClick={handleDownload}
              disabled={downloading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: downloading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: downloading ? 'not-allowed' : 'pointer',
                opacity: downloading ? 0.6 : 1
              }}
            >
              {downloading ? '⏳ Downloading...' : '⬇️ Download GPX'}
            </button>
          </div>
          <h2>{track.name || track.filename}</h2>
          {track.description && (
            <p className="track-description">{track.description}</p>
          )}
        </div>

        <div className="track-stats">
          <div className="stat-grid">
            <div className="stat-item">
              <h3>Distance</h3>
              <p>{formatDistance(track.distance)}</p>
            </div>
            <div className="stat-item">
              <h3>Duration</h3>
              <p>{formatDuration(track.duration)}</p>
            </div>
            <div className="stat-item">
              <h3>Elevation Gain</h3>
              <p>↗ {formatElevation(track.elevation_gain)}</p>
            </div>
            <div className="stat-item">
              <h3>Elevation Loss</h3>
              <p>↘ {formatElevation(track.elevation_loss)}</p>
            </div>
            <div className="stat-item">
              <h3>Max Elevation</h3>
              <p>{formatElevation(track.max_elevation)}</p>
            </div>
            <div className="stat-item">
              <h3>Min Elevation</h3>
              <p>{formatElevation(track.min_elevation)}</p>
            </div>
          </div>

          <div className="track-info">
            <h3>Track Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <strong>Filename:</strong> {track.filename}
              </div>
              {track.type && (
                <div className="info-item">
                  <strong>Type:</strong> {track.type}
                </div>
              )}
              {track.keywords && (
                <div className="info-item">
                  <strong>Keywords:</strong> {track.keywords}
                </div>
              )}
              <div className="info-item">
                <strong>Start Time:</strong> {formatDate(track.start_time)}
              </div>
              <div className="info-item">
                <strong>End Time:</strong> {formatDate(track.end_time)}
              </div>
              <div className="info-item">
                <strong>Created:</strong> {formatDate(track.created_at)}
              </div>
            </div>
          </div>

          <div className="track-bounds">
            <h3>Track Bounds</h3>
            <div className="bounds-grid">
              <div className="bounds-item">
                <strong>North:</strong> {track.bounds.north.toFixed(6)}
              </div>
              <div className="bounds-item">
                <strong>South:</strong> {track.bounds.south.toFixed(6)}
              </div>
              <div className="bounds-item">
                <strong>East:</strong> {track.bounds.east.toFixed(6)}
              </div>
              <div className="bounds-item">
                <strong>West:</strong> {track.bounds.west.toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="track-route-map">
        <TrackRouteMap track={track} />
      </div>
    </div>
  );
};

export default TrackDetails;
