import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CustomerLogin from './pages/CustomerLogin';
import CustomerSignup from './pages/CustomerSignup';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminLayout from './layouts/AdminLayout';
import SuperAdminLayout from './layouts/SuperAdminLayout';
import AdminLogin from './pages/AdminLogin';
import SuperAdminLogin from './pages/SuperAdminLogin';
import RestaurantView from './pages/RestaurantView';
import MenuView from './pages/MenuView';
import BookingView from './pages/BookingView';
import PreOrderView from './pages/PreOrderView';
import PaymentView from './pages/PaymentView';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

// App content component that uses auth context
const AppContent = () => {
  const { authChecked } = useAuth();

  // Show loading screen only while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-6"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">RestaurantAI Platform</h2>
          <p className="text-blue-200 animate-pulse">
            Checking authentication...
          </p>
          <div className="mt-4 w-64 h-1 bg-gray-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: '100%', animation: 'loading 2s ease-in-out' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<CustomerLogin />} />
          <Route path="/signup" element={<CustomerSignup />} />
          <Route path="/admin-dashboard-secret-portal-2025" element={<AdminLogin />} />
          <Route path="/super-admin-control" element={<SuperAdminLogin />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute role="customer">
              <CustomerDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/restaurant/:id" element={
            <ProtectedRoute role="customer">
              <RestaurantView />
            </ProtectedRoute>
          } />
          
          <Route path="/restaurant/:id/menu" element={
            <ProtectedRoute role="customer">
              <MenuView />
            </ProtectedRoute>
          } />
          
          <Route path="/restaurant/:id/booking" element={
            <ProtectedRoute role="customer">
              <BookingView />
            </ProtectedRoute>
          } />
          
          <Route path="/restaurant/:id/preorder" element={
            <ProtectedRoute role="customer">
              <PreOrderView />
            </ProtectedRoute>
          } />
          
          <Route path="/payment" element={
            <ProtectedRoute role="customer">
              <PaymentView />
            </ProtectedRoute>
          } />
          
          <Route path="/admin/*" element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          } />
          
          <Route path="/super-admin/*" element={
            <ProtectedRoute role="superadmin">
              <SuperAdminLayout />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <NotificationProvider>
          {/* Clear any cross-contaminated data on app start */}
          {React.useEffect(() => {
            // Clean up any potentially contaminated localStorage data
            const cleanupData = () => {
              const currentRole = localStorage.getItem('role');
              if (!currentRole) {
                // No role set, clear all data
                localStorage.removeItem('restaurants');
                localStorage.removeItem('menuItems_admin');
                localStorage.removeItem('tables_admin');
                localStorage.removeItem('dashboardData_admin');
                localStorage.removeItem('orders');
                localStorage.removeItem('bookings');
                localStorage.removeItem('cart');
              }
            };
            cleanupData();
          }, [])}
          <AppContent />
        </NotificationProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;