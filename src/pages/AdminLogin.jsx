import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useNotification } from '../context/NotificationContext';

const AdminLogin = () => {
  const location = useLocation();
  const from = location.state?.from || { pathname: '/admin' };
  const [formData, setFormData] = useState({
    adminId: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAdminAuth();
  const { addNotification } = useNotification();

  // Redirect if already authenticated as admin
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(from.pathname || '/admin', { replace: true });
    }
  }, [isAuthenticated, navigate, from]);
  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use the regular login endpoint which now handles admin login
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: formData.adminId,
          password: formData.password
        })
      });

      const response = await res.json();

      if (response.success) {
        const user = response.data.user;
        
        // Verify this is an admin user
        if (user.role !== 'admin') {
          addNotification('Invalid admin credentials. Please use admin login.', 'error');
          setIsLoading(false);
          return;
        }

        // Call login from context - this will set isAuthenticated to true
        login(user, response.data.token);
        addNotification('Admin login successful!', 'success');
        
        // The useEffect will handle navigation after isAuthenticated becomes true
      } else if (response.code === 'SUBSCRIPTION_EXPIRED') {
        addNotification('Subscription Over - Your restaurant subscription has expired. Please contact support.', 'error');
        setIsLoading(false);
      } else {
        addNotification(response.message || 'Invalid admin credentials. Please check your Admin ID and password.', 'error');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.message && (error.message.includes('fetch') || error.message.includes('Network'))) {
        addNotification('Unable to connect to server. Please check your connection and try again.', 'error');
      } else {
        addNotification('Invalid admin credentials. Please check your Admin ID and password.', 'error');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link to="/" className="flex items-center space-x-2">
              <ArrowLeft className="h-5 w-5 text-white" />
              <Shield className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">Admin Portal</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Admin Access</h2>
              <p className="text-gray-300 text-sm md:text-base">Secure login for restaurant administrators</p>
              <div className="mt-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
                <p className="text-blue-200 text-xs">Secret URL: /admin-dashboard-secret-portal-2025</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Admin ID
                </label>
                <input
                  type="text"
                  name="adminId"
                  value={formData.adminId}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                  placeholder="GS001, SS002, MI003"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm pr-12"
                    placeholder="Enter admin password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isLoading ? 'Authenticating...' : 'Access Admin Panel'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Demo Credentials:</strong><br />
                Restaurant Admin: TM001, SG002, or MM003<br />
                Password: admin123
              </p>
            </div>

            <div className="mt-6 text-center">
              <Link to="/" className="text-gray-400 hover:text-gray-300 text-sm transition-colors">
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;