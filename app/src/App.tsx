import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapView from './components/MapView';
import TrackDetailsView from './components/TrackDetailsView';
import EnvVarsView from './components/EnvVarsView';
import SeedingProgress from './components/SeedingProgress';
import ComparisonTrails from './components/ComparisonTrails';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/track/:id" element={<TrackDetailsView />} />
        <Route path="/env-vars" element={<EnvVarsView />} />
        <Route path="/seeding-progress" element={<SeedingProgress />} />
        <Route path="/comparison-trails" element={<ComparisonTrails />} />
      </Routes>
    </Router>
  );
};

export default App;
