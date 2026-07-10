import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AssetOverview } from '@/pages/assets/AssetOverview';
import { AssetDetailPage } from '@/pages/assets/AssetDetail';
import { AssetRisk } from '@/pages/assets/AssetRisk';
import { ContingencyCore } from '@/pages/contingency/ContingencyCore';
import { Settings } from '@/pages/Settings';

// Single Operator Mode: no auth gate, no login route — the app opens
// straight into the Dashboard (Asset Overview). Reactivating multi-tenant
// later means wrapping this back in an AuthProvider/WorkspaceProvider and
// a protected-route check (see git history for the previous version).
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<AssetOverview />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/risk" element={<AssetRisk />} />
            <Route path="/contingency" element={<ContingencyCore />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
