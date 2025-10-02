import React, { useState, useEffect } from 'react';
import { trackAPI } from '../api';

interface SeedingProgressData {
  total_tracks: number;
  loaded_tracks: number;
  is_complete: boolean;
  is_running: boolean;
  error_message?: string;
  last_updated: string;
}

const SeedingProgressBar: React.FC = () => {
  const [progress, setProgress] = useState<SeedingProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await trackAPI.getSeedingProgress();
        setProgress(data);
      } catch (err) {
        console.error('Failed to fetch seeding progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Poll for updates every 3 seconds if seeding is running
    const interval = setInterval(async () => {
      try {
        const data = await trackAPI.getSeedingProgress();
        setProgress(data);
      } catch (err) {
        console.error('Failed to fetch seeding progress:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !progress) {
    return null;
  }

  // Don't show progress bar if seeding is complete
  if (progress.is_complete) {
    return null;
  }

  const percentage = progress.total_tracks > 0 
    ? Math.round((progress.loaded_tracks / progress.total_tracks) * 100)
    : 0;

  return (
    <div className="seeding-progress-bar">
      <div className="progress-info">
        <span className="progress-text">
          {progress.is_complete 
            ? `✅ All tracks loaded: ${progress.loaded_tracks.toLocaleString()} tracks`
            : `Loading tracks: ${progress.loaded_tracks.toLocaleString()} / ${progress.total_tracks.toLocaleString()} (${percentage}%)`
          }
        </span>
        {progress.error_message && (
          <span className="error-text">Error: {progress.error_message}</span>
        )}
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ 
            width: `${percentage}%`,
            background: progress.is_complete ? 'linear-gradient(90deg, #28a745, #20c997)' : 'linear-gradient(90deg, #007bff, #0056b3)'
          }}
        ></div>
      </div>

      <style jsx>{`
        .seeding-progress-bar {
          width: 100%;
          background: #f8f9fa;
          border-bottom: 1px solid #dee2e6;
          padding: 8px 0;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          font-size: 0.85em;
        }

        .progress-text {
          color: #495057;
          font-weight: 500;
        }

        .error-text {
          color: #dc3545;
          font-weight: 500;
        }

        .progress-bar {
          width: 100%;
          height: 6px;
          background: #e9ecef;
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          transition: width 0.3s ease;
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default SeedingProgressBar;
