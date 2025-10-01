import axios from 'axios';
import { GPXTrack, SearchFilters } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2851';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`Making API request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('API request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API response error:', error.response?.status, error.response?.data);
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - check if API server is running');
    }
    return Promise.reject(error);
  }
);

export const trackAPI = {
  // Get all tracks with optional search filters
  getTracks: async (filters?: SearchFilters): Promise<GPXTrack[]> => {
    const params = new URLSearchParams();
    
    if (filters?.query) {
      params.append('q', filters.query);
    }
    if (filters?.minDistance !== undefined) {
      params.append('min_distance', filters.minDistance.toString());
    }
    if (filters?.maxDistance !== undefined) {
      params.append('max_distance', filters.maxDistance.toString());
    }
    if (filters?.minDuration !== undefined) {
      params.append('min_duration', filters.minDuration.toString());
    }
    if (filters?.maxDuration !== undefined) {
      params.append('max_duration', filters.maxDuration.toString());
    }
    // Add geographic bounds parameters
    if (filters?.north !== undefined) {
      params.append('north', filters.north.toString());
    }
    if (filters?.south !== undefined) {
      params.append('south', filters.south.toString());
    }
    if (filters?.east !== undefined) {
      params.append('east', filters.east.toString());
    }
    if (filters?.west !== undefined) {
      params.append('west', filters.west.toString());
    }
    if (filters?.limit !== undefined) {
      params.append('limit', filters.limit.toString());
    }
    if (filters?.includeRoutes) {
      params.append('include_routes', 'true');
    }

    const response = await api.get(`/tracks?${params.toString()}`);
    return response.data;
  },

  // Get a specific track by ID
  getTrack: async (id: number): Promise<GPXTrack> => {
    const response = await api.get(`/tracks/${id}`);
    return response.data;
  },

  // Get tracks within geographic bounds
  getTracksByBounds: async (bounds: { north: number; south: number; east: number; west: number }, limit?: number): Promise<GPXTrack[]> => {
    const params = new URLSearchParams();
    params.append('north', bounds.north.toString());
    params.append('south', bounds.south.toString());
    params.append('east', bounds.east.toString());
    params.append('west', bounds.west.toString());
    
    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }

    const response = await api.get(`/tracks/bounds?${params.toString()}`);
    return response.data;
  },

  // Get track coordinates for multiple tracks
  getTrackCoordinates: async (trackIds: number[]): Promise<Record<string, Array<{ latitude: number; longitude: number; elevation?: number }>>> => {
    const idsParam = trackIds.join(',');
    const response = await api.get(`/track_coordinates?ids=${idsParam}`);
    return response.data;
  },

  // Download GPX file for a track
  downloadGPX: async (trackId: number): Promise<Blob> => {
    const response = await api.get(`/tracks/${trackId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  },

};
