import React, { useState, useEffect } from 'react';
import TrackList from './components/TrackList';
import TrackMap from './components/TrackMap';
import { GPXTrack } from './types';
import { trackAPI } from './api';

const App: React.FC = () => {
  const [tracks, setTracks] = useState<GPXTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<GPXTrack | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await trackAPI.getTracks();
      setTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
    } finally {
      setLoading(false);
    }
  };

  const refreshTracks = async () => {
    setLoading(true);
    setError(null);
    try {
      await trackAPI.refreshTracks();
      await loadTracks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh tracks');
      setLoading(false);
    }
  };

  const handleTrackSelect = (track: GPXTrack) => {
    setSelectedTrack(track);
  };

  useEffect(() => {
    loadTracks();
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>MyTracks - GPX Explorer</h1>
      </header>
      <main className="main-content">
        <TrackList
          tracks={tracks}
          selectedTrack={selectedTrack}
          onTrackSelect={handleTrackSelect}
          loading={loading}
          error={error}
          onRefresh={refreshTracks}
        />
        <div className="map-container">
          <TrackMap selectedTrack={selectedTrack} />
        </div>
      </main>
    </div>
  );
};

export default App;
