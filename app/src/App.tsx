import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapView from './components/MapView';
import TrackDetailsView from './components/TrackDetailsView';
import EnvVarsView from './components/EnvVarsView';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/track/:id" element={<TrackDetailsView />} />
        <Route path="/env-vars" element={<EnvVarsView />} />
      </Routes>
    </Router>
  );
};

export default App;
