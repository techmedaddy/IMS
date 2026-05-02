/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { IncidentDetailPage } from './pages/IncidentDetail';
import { Incidents } from './pages/Incidents';
import { Analytics } from './pages/Analytics';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <Toaster position="top-right" />
    </Router>
  );
}
