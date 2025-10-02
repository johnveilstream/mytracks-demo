import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapView from './components/MapView';
import TrackDetailsView from './components/TrackDetailsView';
import EnvVarsView from './components/EnvVarsView';
import SeedingProgress from './components/SeedingProgress';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/track/:id" element={<TrackDetailsView />} />
        <Route path="/env-vars" element={<EnvVarsView />} />
        <Route path="/seeding-progress" element={<SeedingProgress />} />
      </Routes>
    </Router>
  );
};

export default App;
