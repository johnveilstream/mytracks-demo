import axios from 'axios';
import { GPXTrack, SearchFilters } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:2851';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

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

    const response = await api.get(`/tracks?${params.toString()}`);
    return response.data;
  },

  // Get a specific track by ID
  getTrack: async (id: number): Promise<GPXTrack> => {
    const response = await api.get(`/tracks/${id}`);
    return response.data;
  },

  // Refresh tracks from GPX files
  refreshTracks: async (): Promise<{ message: string; count: number }> => {
    const response = await api.post('/tracks/refresh');
    return response.data;
  },
};
