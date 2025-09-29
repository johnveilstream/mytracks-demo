import React, { useState } from 'react';

interface LocationSearchProps {
  onLocationSearch: (bounds: { north: number; south: number; east: number; west: number }) => void;
  loading: boolean;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

const LocationSearch: React.FC<LocationSearchProps> = ({ onLocationSearch, loading }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setSearching(true);
    try {
      // Use Nominatim (OpenStreetMap) geocoding service
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1&bounded=0`
      );
      
      if (response.ok) {
        const results: GeocodeResult[] = await response.json();
        setSuggestions(results);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    
    // Debounce the search
    const timeoutId = setTimeout(() => {
      searchLocation(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const handleLocationSelect = (result: GeocodeResult) => {
    setQuery(result.display_name);
    setShowSuggestions(false);
    setSuggestions([]);

    // Convert bounding box to our format
    const [south, north, west, east] = result.boundingbox.map(Number);
    
    // Add some padding to the bounds (about 10km in degrees)
    const padding = 0.1;
    const bounds = {
      north: north + padding,
      south: south - padding,
      east: east + padding,
      west: west - padding,
    };

    onLocationSearch(bounds);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleLocationSelect(suggestions[0]);
    }
  };

  return (
    <div style={{ position: 'relative', marginBottom: '1rem' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search for a location (city, country, etc.)"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            backgroundColor: loading ? '#f5f5f5' : 'white',
          }}
        />
        
        {searching && (
          <div style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '12px',
            color: '#666',
          }}>
            Searching...
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          {suggestions.map((result, index) => (
            <div
              key={index}
              onClick={() => handleLocationSelect(result)}
              style={{
                padding: '0.75rem',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid #eee' : 'none',
                fontSize: '14px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              <div style={{ fontWeight: '500' }}>{result.display_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
