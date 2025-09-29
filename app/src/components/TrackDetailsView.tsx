import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TrackDetails from './TrackDetails';
import { GPXTrack } from '../types';
import { trackAPI } from '../api';

const TrackDetailsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [track, setTrack] = useState<GPXTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrack = async () => {
      if (!id) {
        setError('No track ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const trackData = await trackAPI.getTrack(parseInt(id, 10));
        setTrack(trackData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load track');
      } finally {
        setLoading(false);
      }
    };

    loadTrack();
  }, [id]);

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <h1>MyTracks - GPX Explorer</h1>
        </header>
        <main className="main-content">
          <div className="loading">Loading track details...</div>
        </main>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="app">
        <header className="header">
          <h1>MyTracks - GPX Explorer</h1>
        </header>
        <main className="main-content">
          <div className="error">
            {error || 'Track not found'}
            <button 
              onClick={handleBack}
              style={{ marginLeft: '1rem', padding: '0.5rem 1rem', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Back to Map
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>MyTracks - GPX Explorer</h1>
      </header>
      <main className="main-content">
        <TrackDetails 
          track={track} 
          onBack={handleBack}
        />
      </main>
    </div>
  );
};

export default TrackDetailsView;
