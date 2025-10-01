import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface EnvVarsData {
  environment_variables: Record<string, string>;
}

const EnvVarsView: React.FC = () => {
  const [reactEnvVars, setReactEnvVars] = useState<Record<string, string>>({});
  const [apiEnvVars, setApiEnvVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEnvVars = async () => {
      try {
        setLoading(true);
        
        // Get React app environment variables
        const reactVars: Record<string, string> = {};
        Object.keys(process.env).forEach(key => {
          if (key.startsWith('REACT_APP_')) {
            reactVars[key] = process.env[key] || '';
          }
        });
        setReactEnvVars(reactVars);

        // Get API environment variables
        try {
          const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2851';
          const response = await axios.get(`${API_BASE_URL}/env-vars`);
          setApiEnvVars(response.data.environment_variables);
        } catch (apiError) {
          console.error('Failed to fetch API environment variables:', apiError);
          setError('Failed to fetch API environment variables. Make sure the API server is running.');
        }
      } catch (err) {
        setError('Failed to load environment variables');
        console.error('Error loading environment variables:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEnvVars();
  }, []);

  const renderEnvVars = (envVars: Record<string, string>, title: string) => (
    <div className="env-section">
      <h3>{title}</h3>
      {Object.keys(envVars).length === 0 ? (
        <p className="no-vars">No environment variables found</p>
      ) : (
        <div className="env-vars-list">
          {Object.entries(envVars)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => (
              <div key={key} className="env-var-item">
                <div className="env-var-key">{key}</div>
                <div className="env-var-value">{value}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="env-vars-container">
        <h2>Environment Variables</h2>
        <div className="loading">Loading environment variables...</div>
      </div>
    );
  }

  return (
    <div className="env-vars-container">
      <h2>Environment Variables</h2>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      <div className="env-vars-content">
        {renderEnvVars(reactEnvVars, 'React App Environment Variables')}
        {renderEnvVars(apiEnvVars, 'API Server Environment Variables')}
      </div>

      <style jsx>{`
        .env-vars-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .env-vars-container h2 {
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }

        .env-vars-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }

        .env-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e9ecef;
        }

        .env-section h3 {
          color: #495057;
          margin-top: 0;
          margin-bottom: 20px;
          font-size: 1.2em;
        }

        .env-vars-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .env-var-item {
          display: flex;
          flex-direction: column;
          margin-bottom: 15px;
          padding: 10px;
          background: white;
          border-radius: 4px;
          border: 1px solid #dee2e6;
        }

        .env-var-key {
          font-weight: bold;
          color: #007bff;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.9em;
          margin-bottom: 5px;
          word-break: break-all;
        }

        .env-var-value {
          color: #6c757d;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 0.85em;
          word-break: break-all;
          background: #f8f9fa;
          padding: 5px;
          border-radius: 3px;
        }

        .no-vars {
          color: #6c757d;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }

        .loading {
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
          .env-vars-content {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default EnvVarsView;
