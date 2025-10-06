import React, { useState, useEffect } from 'react';
import { trackAPI } from '../api';

interface ComparisonTrack {
  id: string;
  filename: string;
  name: string;
  distance: number;
  duration: number;
  elevationGain: number;
  elevationLoss: number;
  maxElevation: number;
  minElevation: number;
  startTime?: string;
  endTime?: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  elevationProfile: { distance: number; elevation: number }[];
  estimatedHours: number;
  actualHours: number;
  speedRatio: number;
  uploadedAt: string;
}

const ComparisonTrails: React.FC = () => {
  const [uploadedTracks, setUploadedTracks] = useState<ComparisonTrack[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [estimatedTracks, setEstimatedTracks] = useState<any[]>([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);

  // Load tracks from localStorage on component mount
  useEffect(() => {
    const storedTracks = localStorage.getItem('comparisonTracks');
    if (storedTracks) {
      try {
        const parsedTracks = JSON.parse(storedTracks);
        setUploadedTracks(parsedTracks);
        console.log(`Loaded ${parsedTracks.length} tracks from localStorage`);
      } catch (err) {
        console.error('Error loading tracks from localStorage:', err);
        setError('Failed to load saved tracks from localStorage');
      }
    }
  }, []);

  // Save tracks to localStorage whenever uploadedTracks changes
  useEffect(() => {
    localStorage.setItem('comparisonTracks', JSON.stringify(uploadedTracks));
  }, [uploadedTracks]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.gpx')) {
          setError(`File ${file.name} is not a GPX file`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        // Parse the GPX file locally
        const trackData = await parseGPXFile(file);
        
        const newTrack: ComparisonTrack = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          name: trackData.name || file.name.replace('.gpx', ''),
          distance: trackData.distance,
          duration: trackData.duration,
          elevationGain: trackData.elevationGain,
          elevationLoss: trackData.elevationLoss,
          maxElevation: trackData.maxElevation,
          minElevation: trackData.minElevation,
          startTime: trackData.startTime,
          endTime: trackData.endTime,
          bounds: trackData.bounds,
          elevationProfile: trackData.elevationProfile,
          estimatedHours: trackData.estimatedHours,
          actualHours: trackData.actualHours,
          speedRatio: trackData.speedRatio,
          uploadedAt: new Date().toISOString()
        };

        setUploadedTracks(prev => [...prev, newTrack]);
      }

      setSuccess(`Successfully uploaded ${files.length} track(s)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  // Function to calculate elevation changes by analyzing up/down segments
  const calculateElevationChanges = (points: { lat: number; lon: number; ele?: number; time?: Date }[]) => {
    let elevationGain = 0;
    let elevationLoss = 0;
    
    // Filter points that have elevation data
    const pointsWithElevation = points.filter(p => p.ele !== undefined);
    
    if (pointsWithElevation.length < 2) {
      return { calculatedElevationGain: 0, calculatedElevationLoss: 0 };
    }
    
    // Find up and down segments
    let currentSegment: 'up' | 'down' | 'flat' | null = null;
    let segmentStartElevation = pointsWithElevation[0].ele!;
    let segmentStartIndex = 0;
    
    for (let i = 1; i < pointsWithElevation.length; i++) {
      const prevElevation = pointsWithElevation[i - 1].ele!;
      const currentElevation = pointsWithElevation[i].ele!;
      const elevationChange = currentElevation - prevElevation;
      
      // Determine current segment type
      let segmentType: 'up' | 'down' | 'flat' | null = null;
      if (Math.abs(elevationChange) > 0.5) { // 0.5m threshold to avoid noise
        segmentType = elevationChange > 0 ? 'up' : 'down';
      } else {
        segmentType = 'flat';
      }
      
      // If segment type changed, process the previous segment
      if (currentSegment !== null && currentSegment !== segmentType) {
        const segmentEndElevation = pointsWithElevation[i - 1].ele!;
        const segmentElevationChange = segmentEndElevation - segmentStartElevation;
        
        if (currentSegment === 'up' && segmentElevationChange > 0) {
          elevationGain += segmentElevationChange;
        } else if (currentSegment === 'down' && segmentElevationChange < 0) {
          elevationLoss += Math.abs(segmentElevationChange);
        }
        
        // Start new segment
        segmentStartElevation = pointsWithElevation[i - 1].ele!;
        segmentStartIndex = i - 1;
      }
      
      currentSegment = segmentType;
    }
    
    // Process the final segment
    if (currentSegment !== null) {
      const segmentEndElevation = pointsWithElevation[pointsWithElevation.length - 1].ele!;
      const segmentElevationChange = segmentEndElevation - segmentStartElevation;
      
      if (currentSegment === 'up' && segmentElevationChange > 0) {
        elevationGain += segmentElevationChange;
      } else if (currentSegment === 'down' && segmentElevationChange < 0) {
        elevationLoss += Math.abs(segmentElevationChange);
      }
    }
    
    return {
      calculatedElevationGain: elevationGain,
      calculatedElevationLoss: elevationLoss
    };
  };

  const parseGPXFile = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'text/xml');
          
          // Check for parsing errors
          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            throw new Error('Invalid GPX file format');
          }

          const track = xmlDoc.querySelector('trk');
          if (!track) {
            throw new Error('No track found in GPX file');
          }

          const name = track.querySelector('name')?.textContent || '';
          const segments = track.querySelectorAll('trkseg');
          
          let totalDistance = 0;
          let totalDuration = 0;
          let elevationGain = 0;
          let elevationLoss = 0;
          let maxElevation = -Infinity;
          let minElevation = Infinity;
          let startTime: Date | null = null;
          let endTime: Date | null = null;
          let bounds = {
            north: -90,
            south: 90,
            east: -180,
            west: 180
          };
          let elevationProfile: { distance: number; elevation: number }[] = [];
          let allPoints: { lat: number; lon: number; ele?: number; time?: Date }[] = [];

          segments.forEach(segment => {
            const points = segment.querySelectorAll('trkpt');
            let prevPoint: { lat: number; lon: number; ele?: number; time?: Date } | null = null;

            points.forEach(point => {
              const lat = parseFloat(point.getAttribute('lat') || '0');
              const lon = parseFloat(point.getAttribute('lon') || '0');
              const ele = point.querySelector('ele')?.textContent;
              const time = point.querySelector('time')?.textContent;
              
              const elevation = ele ? parseFloat(ele) : undefined;
              const pointTime = time ? new Date(time) : undefined;

              // Update bounds
              bounds.north = Math.max(bounds.north, lat);
              bounds.south = Math.min(bounds.south, lat);
              bounds.east = Math.max(bounds.east, lon);
              bounds.west = Math.min(bounds.west, lon);

              // Update elevation stats
              if (elevation !== undefined) {
                maxElevation = Math.max(maxElevation, elevation);
                minElevation = Math.min(minElevation, elevation);
              }

              // Update time stats
              if (pointTime) {
                if (!startTime) startTime = pointTime;
                endTime = pointTime;
              }

              // Calculate distance
              if (prevPoint) {
                const distance = calculateDistance(
                  prevPoint.lat, prevPoint.lon,
                  lat, lon
                );
                totalDistance += distance;
              }

              // Add to elevation profile
              elevationProfile.push({
                distance: totalDistance,
                elevation: elevation || 0
              });

              // Collect all points for elevation analysis
              allPoints.push({ lat, lon, ele: elevation, time: pointTime });

              prevPoint = { lat, lon, ele: elevation, time: pointTime };
            });
          });

          // Calculate duration
          if (startTime && endTime) {
            totalDuration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          }

          // Recalculate elevation gain/loss by analyzing up/down segments
          const { calculatedElevationGain, calculatedElevationLoss } = calculateElevationChanges(allPoints);

          // Calculate hour estimates using calculated elevation values
          const verticalHours = calculatedElevationGain / 300; // 300m vertical gain = 1hr
          const horizontalHours = totalDistance / 3500; // 3.5km horizontal = 1hr
          const estimatedHours = verticalHours + horizontalHours;
          const actualHours = totalDuration / 3600; // Convert seconds to hours
          const speedRatio = actualHours > 0 ? estimatedHours / actualHours : 1;

          resolve({
            name,
            distance: totalDistance,
            duration: totalDuration,
            elevationGain: calculatedElevationGain,
            elevationLoss: calculatedElevationLoss,
            maxElevation: maxElevation === -Infinity ? 0 : maxElevation,
            minElevation: minElevation === Infinity ? 0 : minElevation,
            startTime: startTime?.toISOString(),
            endTime: endTime?.toISOString(),
            bounds,
            elevationProfile,
            estimatedHours,
            actualHours,
            speedRatio
          });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const removeTrack = (id: string) => {
    setUploadedTracks(prev => {
      const updatedTracks = prev.filter(track => track.id !== id);
      // Update localStorage immediately
      localStorage.setItem('comparisonTracks', JSON.stringify(updatedTracks));
      return updatedTracks;
    });
  };

  const clearAllTracks = () => {
    setUploadedTracks([]);
  };

  const fetchEstimatedTracks = async () => {
    if (uploadedTracks.length === 0) return;

    setLoadingEstimates(true);
    try {
      // Calculate average estimated hours from uploaded tracks
      const avgEstimatedHours = uploadedTracks.reduce((sum, track) => sum + track.estimatedHours, 0) / uploadedTracks.length;
      
      // Fetch tracks with estimated duration ±1 hour
      const tracks = await trackAPI.getTracks({
        estimatedDuration: Math.round(avgEstimatedHours),
        limit: 20
      });
      
      setEstimatedTracks(tracks);
    } catch (err) {
      console.error('Failed to fetch estimated tracks:', err);
      setError('Failed to fetch estimated tracks');
    } finally {
      setLoadingEstimates(false);
    }
  };

  // Fetch estimated tracks when uploaded tracks change
  useEffect(() => {
    if (uploadedTracks.length > 0) {
      fetchEstimatedTracks();
    } else {
      setEstimatedTracks([]);
    }
  }, [uploadedTracks]);

  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Calculate average speed ratio from all tracks
  const averageSpeedRatio = uploadedTracks.length > 0 
    ? uploadedTracks.reduce((sum, track) => sum + track.speedRatio, 0) / uploadedTracks.length 
    : 1;

  // Component for elevation profile graph
  const ElevationProfile: React.FC<{ profile: { distance: number; elevation: number }[] }> = ({ profile }) => {
    const [hoveredPoint, setHoveredPoint] = useState<{ distance: number; elevation: number; x: number; y: number } | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    if (profile.length === 0) return null;

    const maxDistance = Math.max(...profile.map(p => p.distance));
    const minElevation = Math.min(...profile.map(p => p.elevation));
    const maxElevation = Math.max(...profile.map(p => p.elevation));
    const elevationRange = maxElevation - minElevation;

    if (elevationRange === 0) return null;

    const width = 280;
    const height = 60;

    // Sample points for performance but keep more for better hover accuracy
    const sampledPoints = profile.filter((_, i) => i % Math.ceil(profile.length / 100) === 0);
    
    const points = sampledPoints.map((point, i) => {
      const x = (point.distance / maxDistance) * width;
      const y = height - ((point.elevation - minElevation) / elevationRange) * height;
      return { ...point, x, y };
    });

    const pointsString = points.map(p => `${p.x},${p.y}`).join(' ');

    const handleMouseMove = (e: React.MouseEvent<SVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Find the closest point to the mouse
      let closestPoint = null;
      let minDistance = Infinity;
      
      points.forEach(point => {
        const distance = Math.sqrt(Math.pow(point.x - mouseX, 2) + Math.pow(point.y - mouseY, 2));
        if (distance < minDistance && distance < 20) { // 20px threshold
          minDistance = distance;
          closestPoint = point;
        }
      });
      
      if (closestPoint) {
        setHoveredPoint(closestPoint);
        setMousePosition({ x: e.clientX, y: e.clientY });
      } else {
        setHoveredPoint(null);
      }
    };

    const handleMouseLeave = () => {
      setHoveredPoint(null);
    };

    return (
      <div className="elevation-profile">
        <svg 
          width={width} 
          height={height} 
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'crosshair' }}
        >
          <polyline
            points={pointsString}
            fill="none"
            stroke="#007bff"
            strokeWidth="1.5"
          />
          <defs>
            <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#007bff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#007bff" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${pointsString} ${width},${height}`}
            fill="url(#elevationGradient)"
          />
          
          {/* Invisible hover area */}
          <polyline
            points={pointsString}
            fill="none"
            stroke="transparent"
            strokeWidth="8"
            style={{ cursor: 'crosshair' }}
          />
        </svg>
        
        <div className="profile-labels">
          <span className="distance-label">{formatDistance(maxDistance)}</span>
          <span className="elevation-label">{Math.round(maxElevation)}m</span>
        </div>
        
        {hoveredPoint && (
          <div 
            className="elevation-tooltip"
            style={{
              position: 'fixed',
              left: mousePosition.x + 10,
              top: mousePosition.y - 10,
              zIndex: 1000
            }}
          >
            <div className="tooltip-content">
              <div className="tooltip-elevation">{Math.round(hoveredPoint.elevation)}m</div>
              <div className="tooltip-distance">{formatDistance(hoveredPoint.distance)}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="comparison-trails-container">
      <h2>Set Comparison Trails</h2>
      
      <div className="upload-section">
        <div className="upload-area">
          <input
            type="file"
            id="gpx-upload"
            multiple
            accept=".gpx"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <label htmlFor="gpx-upload" className="upload-button">
            {uploading ? 'Uploading...' : 'Upload GPX Files'}
          </label>
          <p className="upload-hint">Select one or more GPX files to upload</p>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="success-message">
            <p>{success}</p>
          </div>
        )}
      </div>

      {uploadedTracks.length > 0 && (
        <div className="tracks-section">
          <div className="average-speed-section">
            <h3>Your Relative Speed</h3>
            <div className="average-speed-display">
              <div className="speed-number">{averageSpeedRatio.toFixed(2)}x</div>
              <div className="speed-description">
                Based on {uploadedTracks.length} track{uploadedTracks.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="tracks-header">
            <h3>Uploaded Tracks ({uploadedTracks.length})</h3>
            <button 
              className="clear-button" 
              onClick={clearAllTracks}
            >
              Clear All
            </button>
          </div>

          <div className="tracks-grid">
            {uploadedTracks.map(track => (
              <div key={track.id} className="track-card">
                <div className="track-header">
                  <h4>{track.name}</h4>
                  <button 
                    className="remove-button" 
                    onClick={() => removeTrack(track.id)}
                    title="Remove track"
                  >
                    ×
                  </button>
                </div>
                
                <div className="track-stats">
                  <div className="stat">
                    <span className="stat-label">Distance:</span>
                    <span className="stat-value">{formatDistance(track.distance)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Duration:</span>
                    <span className="stat-value">{formatDuration(track.duration)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Elevation Gain:</span>
                    <span className="stat-value">{Math.round(track.elevationGain)}m</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Max Elevation:</span>
                    <span className="stat-value">{Math.round(track.maxElevation)}m</span>
                  </div>
                </div>

                <div className="speed-ratio">
                  <div className="speed-ratio-label">Relative Speed:</div>
                  <div className="speed-ratio-value">{track.speedRatio.toFixed(2)}x</div>
                </div>

                <div className="elevation-graph">
                  <ElevationProfile profile={track.elevationProfile} />
                </div>

                <div className="track-meta">
                  <small>Uploaded: {new Date(track.uploadedAt).toLocaleString()}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {estimatedTracks.length > 0 && (
        <div className="estimated-tracks-section">
          <h3>Similar Duration Tracks</h3>
          <p className="section-description">
            Tracks with similar estimated duration based on your comparison data
          </p>
          
          {loadingEstimates ? (
            <div className="loading">Loading estimated tracks...</div>
          ) : (
            <div className="estimated-tracks-grid">
              {estimatedTracks.map(track => (
                <div key={track.id} className="estimated-track-card">
                  <div className="track-name">{track.name}</div>
                  <div className="track-stats">
                    <div className="stat">
                      <span className="stat-label">Distance:</span>
                      <span className="stat-value">{formatDistance(track.distance)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Duration:</span>
                      <span className="stat-value">{formatDuration(track.duration)}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Elevation Gain:</span>
                      <span className="stat-value">{Math.round(track.elevation_gain)}m</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .comparison-trails-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .comparison-trails-container h2 {
          color: #333;
          border-bottom: 2px solid #007bff;
          padding-bottom: 10px;
          margin-bottom: 30px;
        }

        .upload-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 30px;
          text-align: center;
          margin-bottom: 30px;
          border: 2px dashed #dee2e6;
        }

        .upload-button {
          display: inline-block;
          background: #007bff;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: background-color 0.2s ease;
          border: none;
        }

        .upload-button:hover {
          background: #0056b3;
        }

        .upload-hint {
          margin-top: 10px;
          color: #6c757d;
          font-size: 14px;
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 15px;
          border-radius: 4px;
          border: 1px solid #f5c6cb;
          margin-top: 15px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 15px;
          border-radius: 4px;
          border: 1px solid #c3e6cb;
          margin-top: 15px;
        }

        .tracks-section {
          margin-top: 30px;
        }

        .tracks-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .tracks-header h3 {
          margin: 0;
          color: #333;
        }

        .clear-button {
          background: #dc3545;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .clear-button:hover {
          background: #c82333;
        }

        .tracks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .track-card {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .track-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .track-header h4 {
          margin: 0;
          color: #333;
          font-size: 1.1em;
        }

        .remove-button {
          background: #dc3545;
          color: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-button:hover {
          background: #c82333;
        }

        .track-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
        }

        .stat {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 0.8em;
          color: #6c757d;
          margin-bottom: 2px;
        }

        .stat-value {
          font-weight: bold;
          color: #333;
        }

        .track-meta {
          color: #6c757d;
          font-size: 0.9em;
        }

        .average-speed-section {
          background: linear-gradient(135deg, #007bff, #0056b3);
          color: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
          text-align: center;
        }

        .average-speed-section h3 {
          margin: 0 0 20px 0;
          font-size: 1.5em;
        }

        .average-speed-display {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .speed-number {
          font-size: 4em;
          font-weight: bold;
          margin-bottom: 10px;
          text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .speed-description {
          font-size: 1.1em;
          opacity: 0.9;
        }

        .speed-ratio {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          text-align: center;
          border: 2px solid #007bff;
        }

        .speed-ratio-label {
          font-size: 0.9em;
          color: #6c757d;
          margin-bottom: 5px;
        }

        .speed-ratio-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #007bff;
        }

        .elevation-graph {
          margin: 15px 0;
          padding: 10px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .elevation-profile {
          position: relative;
        }

        .profile-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 5px;
          font-size: 0.8em;
          color: #6c757d;
        }

        .distance-label {
          font-weight: 500;
        }

        .elevation-label {
          font-weight: 500;
        }

        .elevation-tooltip {
          pointer-events: none;
          z-index: 1000;
        }

        .tooltip-content {
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85em;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          white-space: nowrap;
        }

        .tooltip-elevation {
          font-weight: bold;
          font-size: 1.1em;
          margin-bottom: 2px;
        }

        .tooltip-distance {
          color: #ccc;
          font-size: 0.9em;
        }

        .estimated-tracks-section {
          margin-top: 40px;
          padding: 30px;
          background: #f8f9fa;
          border-radius: 12px;
          border: 1px solid #dee2e6;
        }

        .estimated-tracks-section h3 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .section-description {
          color: #6c757d;
          margin-bottom: 20px;
          font-size: 0.95em;
        }

        .estimated-tracks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 15px;
        }

        .estimated-track-card {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .estimated-track-card .track-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          font-size: 0.95em;
        }

        .estimated-track-card .track-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .estimated-track-card .stat {
          display: flex;
          justify-content: space-between;
          font-size: 0.85em;
        }

        .estimated-track-card .stat-label {
          color: #6c757d;
        }

        .estimated-track-card .stat-value {
          font-weight: 500;
          color: #333;
        }

        @media (max-width: 768px) {
          .tracks-grid {
            grid-template-columns: 1fr;
          }
          
          .track-stats {
            grid-template-columns: 1fr;
          }

          .speed-number {
            font-size: 3em;
          }
        }
      `}</style>
    </div>
  );
};

export default ComparisonTrails;
