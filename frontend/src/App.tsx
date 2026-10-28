import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NetworkTopologyPage } from './pages/NetworkTopologyPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { TrafficPage } from './pages/TrafficPage';
import { RoutingLabPage } from './pages/RoutingLabPage';
import { SimulationPage } from './pages/SimulationPage';
import { TelemetryPage } from './pages/TelemetryPage';
import { AlertsPage } from './pages/AlertsPage';
import { SecurityPage } from './pages/SecurityPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { NetworkEventProvider } from './context/NetworkEventContext';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <NetworkEventProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<LandingPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="topology" element={<NetworkTopologyPage />} />
            <Route path="routing-lab" element={<RoutingLabPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="traffic" element={<TrafficPage />} />
            <Route path="simulation" element={<SimulationPage />} />
            <Route path="router-drill" element={<SimulationPage />} />
            <Route path="telemetry" element={<TelemetryPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </NetworkEventProvider>
    </BrowserRouter>
  );
};

export default App;
