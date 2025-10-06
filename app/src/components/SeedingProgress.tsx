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

const SeedingProgress: React.FC = () => {
  const [progress, setProgress] = useState<SeedingProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const data = await trackAPI.getSeedingProgress();
        setProgress(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch seeding progress:', err);
        setError('Failed to fetch seeding progress');
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // Poll for updates every 2 seconds if seeding is running
    const interval = setInterval(async () => {
      try {
        const data = await trackAPI.getSeedingProgress();
        setProgress(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch seeding progress:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="seeding-progress-container">
        <h2>Track Seeding Progress</h2>
        <div className="loading">Loading progress...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="seeding-progress-container">
        <h2>Track Seeding Progress</h2>
        <div className="error-message">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="seeding-progress-container">
        <h2>Track Seeding Progress</h2>
        <div className="no-data">No progress data available</div>
      </div>
    );
  }

  const percentage = progress.total_tracks > 0 
    ? Math.round((progress.loaded_tracks / progress.total_tracks) * 100)
    : 0;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="seeding-progress-container">
      <h2>Track Seeding Progress</h2>
      
      {progress.error_message && (
        <div className="error-message">
          <p><strong>Error:</strong> {progress.error_message}</p>
        </div>
      )}

      <div className="progress-info">
        <div className="progress-stats">
          <div className="stat">
            <span className="label">Loaded:</span>
            <span className="value">{progress.loaded_tracks.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">Total:</span>
            <span className="value">{progress.total_tracks.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="label">Progress:</span>
            <span className="value">{percentage}%</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <div className="progress-text">
            {progress.loaded_tracks} / {progress.total_tracks} tracks
          </div>
        </div>

        <div className="status-info">
          <div className="status">
            <span className="label">Status:</span>
            <span className={`value status-${progress.is_complete ? 'complete' : progress.is_running ? 'running' : 'idle'}`}>
              {progress.is_complete ? 'Complete' : progress.is_running ? 'Running' : 'Idle'}
            </span>
          </div>
          <div className="last-updated">
            <span className="label">Last Updated:</span>
            <span className="value">{formatTime(progress.last_updated)}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .seeding-progress-container {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .seeding-progress-container h2 {
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }

        .progress-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e9ecef;
        }

        .progress-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .stat .label {
          font-size: 0.9em;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .stat .value {
          font-size: 1.5em;
          font-weight: bold;
          color: #007bff;
        }

        .progress-bar-container {
          margin-bottom: 25px;
        }

        .progress-bar {
          width: 100%;
          height: 20px;
          background: #e9ecef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          transition: width 0.3s ease;
          border-radius: 10px;
        }

        .progress-text {
          text-align: center;
          font-size: 0.9em;
          color: #6c757d;
        }

        .status-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .status, .last-updated {
          display: flex;
          flex-direction: column;
          padding: 15px;
          background: white;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .status .label, .last-updated .label {
          font-size: 0.9em;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .status .value, .last-updated .value {
          font-weight: 500;
        }

        .status-complete {
          color: #28a745;
        }

        .status-running {
          color: #007bff;
        }

        .status-idle {
          color: #6c757d;
        }

        .loading, .no-data {
          text-align: center;
          padding: 40px;
          color: #6c757d;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 4px;
          border: 1px solid #f5c6cb;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .progress-stats {
            grid-template-columns: 1fr;
          }
          
          .status-info {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default SeedingProgress;
