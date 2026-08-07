import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from './components/ui/Layout';

const Home = lazy(() => import('./pages/Home'));
const ReviewDashboard = lazy(() => import('./pages/ReviewDashboard'));
const History = lazy(() => import('./pages/History'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<UserDashboard />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="review/:jobId" element={<ReviewDashboard />} />
            <Route path="history" element={<History />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
