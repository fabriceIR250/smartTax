import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { initOfflineSync } from './offline/syncManager';
import { registerSW } from './offline/swRegistration';
import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/Common/LoadingSpinner';
import OfflineBanner from './components/Common/OfflineBanner';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const Sales = lazy(() => import('./pages/Sales'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Taxes = lazy(() => import('./pages/Taxes'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

function App() {
  const { token, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
    registerSW();
    initOfflineSync();
  }, []);

  const ProtectedRoute = ({ children, roles }) => {
    if (!token) return <Navigate to="/login" />;
    if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" />;
    return children;
  };

  return (
    <Router>
      <OfflineBanner />
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="sales" element={<Sales />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="taxes" element={<Taxes />} />
            
            <Route path="admin" element={
              <ProtectedRoute roles={['national_admin', 'provincial_admin', 'district_admin', 'sector_admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;