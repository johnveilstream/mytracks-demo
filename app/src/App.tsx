import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MapView from './components/MapView';
import TrackDetailsView from './components/TrackDetailsView';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/track/:id" element={<TrackDetailsView />} />
      </Routes>
    </Router>
  );
};

export default App;
