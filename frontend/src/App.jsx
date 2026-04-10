import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './hooks/useAuth.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// Public pages (eagerly loaded)
import Register from './pages/public/Register';
import Recap from './pages/public/Recap';
import Processing from './pages/public/Processing';
import Success from './pages/public/Success';
import Failed from './pages/public/Failed';
import SetPassword from './pages/public/SetPassword';
import PrivacyPolicy from './pages/public/PrivacyPolicy';
import FAQ from './pages/public/FAQ';
import Terms from './pages/public/Terms';
import LegalNotice from './pages/public/LegalNotice';

// Admin pages (lazy loaded)
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ScannerView = lazy(() => import('./pages/admin/ScannerView'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const Activity = lazy(() => import('./pages/admin/Activity'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));

function AdminRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) return <Navigate to="/admin/login" replace />;
  return children;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/recap" element={<Recap />} />
          <Route path="/payment/processing" element={<Processing />} />
          <Route path="/success" element={<Success />} />
          <Route path="/failed" element={<Failed />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-conditions" element={<Terms />} />
          <Route path="/mentions-legales" element={<LegalNotice />} />
          <Route path="/faq" element={<FAQ />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminRoute><Dashboard /></AdminRoute>} />
          <Route path="/admin/scan" element={<AdminRoute><ScannerView /></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><Settings /></AdminRoute>} />
          <Route path="/admin/activity" element={<AdminRoute><Activity /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
