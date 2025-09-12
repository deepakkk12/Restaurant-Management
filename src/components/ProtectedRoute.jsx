import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
  const { isAuthenticated, role: userRole, authChecked } = useAuth();

  // Show loading spinner only while checking authentication
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to appropriate login page if not authenticated
  if (!isAuthenticated) {
    if (role === 'admin') return <Navigate to="/admin-dashboard-secret-portal-2025" replace />;
    if (role === 'superadmin') return <Navigate to="/super-admin-control" replace />;
    return <Navigate to="/login" replace />;
  }

  // Check role authorization
  if (role && userRole !== role) {
    // Clear localStorage to prevent data contamination between roles
    localStorage.removeItem('restaurants');
    localStorage.removeItem('menuItems_admin');
    localStorage.removeItem('tables_admin');
    localStorage.removeItem('orders');
    localStorage.removeItem('bookings');
    localStorage.removeItem('cart');
    
    // Redirect to appropriate dashboard based on user's actual role
    if (userRole === 'admin') return <Navigate to="/admin" replace />;
    if (userRole === 'superadmin') return <Navigate to="/super-admin" replace />;
    if (userRole === 'customer') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;