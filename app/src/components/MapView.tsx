import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TrackList from './TrackList';
import TrackMap from './TrackMap';
import SeedingProgressBar from './SeedingProgressBar';
import HamburgerMenu from './HamburgerMenu';
import { GPXTrack } from '../types';
import { trackAPI } from '../api';

const MapView: React.FC = () => {
  const [tracks, setTracks] = useState<GPXTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<GPXTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const navigate = useNavigate();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const loadTracks = async (bounds?: { north: number; south: number; east: number; west: number }) => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (bounds) {
        // Load tracks for the specific viewport bounds
        data = await trackAPI.getTracks({
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
          limit: 50 // Limit to 50 tracks for performance
        });
      } else {
        // Load general tracks (fallback)
        data = await trackAPI.getTracks({ limit: 100 });
      }
      setTracks(data);
      if (!hasInitialLoad) {
        setHasInitialLoad(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSelect = (track: GPXTrack) => {
    setSelectedTrack(track);
  };

  const handleTrackClick = (track: GPXTrack) => {
    setSelectedTrack(track);
    navigate(`/track/${track.id}`);
  };


  const handleViewportChange = useCallback((bounds: { north: number; south: number; east: number; west: number }) => {
    // Don't reload if a track is selected (user is viewing a specific track)
    if (selectedTrack) return;
    
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer to debounce the API call
    debounceTimer.current = setTimeout(() => {
      loadTracks(bounds);
    }, hasInitialLoad ? 500 : 100); // Faster initial load, then debounced
  }, [selectedTrack, hasInitialLoad]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>MyTracks - GPX Explorer</h1>
          <HamburgerMenu />
        </div>
        <SeedingProgressBar />
      </header>
      <main className="main-content">
        <TrackList
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackSelect={handleTrackSelect}
          onTrackClick={handleTrackClick}
          loading={loading}
          error={error}
        />
        <div className="map-container">
          <TrackMap 
            tracks={tracks}
            selectedTrack={selectedTrack} 
            onViewportChange={handleViewportChange}
            onTrackClick={handleTrackClick}
          />
        </div>
      </main>
    </div>
  );
};

export default MapView;
