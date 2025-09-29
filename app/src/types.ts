export interface GPXTrack {
  id: number;
  filename: string;
  name: string;
  description?: string;
  distance: number;
  duration: number;
  elevation_gain: number;
  elevation_loss: number;
  max_elevation: number;
  min_elevation: number;
  start_time: string;
  end_time: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  track_points: TrackPoint[];
  created_at: string;
  updated_at: string;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: string;
}

export interface SearchFilters {
  query: string;
  minDistance?: number;
  maxDistance?: number;
  minDuration?: number;
  maxDuration?: number;
}
