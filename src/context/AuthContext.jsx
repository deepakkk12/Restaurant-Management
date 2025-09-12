 import React, { createContext, useContext, useState, useEffect } from 'react';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Check for stored authentication on app load
    const checkStoredAuth = () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedRole = localStorage.getItem('role');
        const storedToken = localStorage.getItem('token');
        
        if (storedUser && storedRole && storedToken) {
          const parsedUser = JSON.parse(storedUser);
            
          // Validate token is not expired
          try {
            const tokenPayload = JSON.parse(atob(storedToken.split('.')[1]));
            const currentTime = Date.now() / 1000;
            
            if (tokenPayload.exp && tokenPayload.exp > currentTime) {
              // Token is valid - verify role matches stored role
              if (tokenPayload.role === storedRole) {
              setUser(parsedUser);
              setRole(storedRole);
              setToken(storedToken);
              setIsAuthenticated(true);
              console.log('✅ Authentication restored from localStorage');
              } else {
                // Role mismatch, clear storage
                console.log('⚠️ Role mismatch in token, clearing stored auth');
                localStorage.removeItem('user');
                localStorage.removeItem('role');
                localStorage.removeItem('token');
              }
            } else {
              // Token expired, clear storage
              console.log('⚠️ Token expired, clearing stored auth');
              localStorage.removeItem('user');
              localStorage.removeItem('role');
              localStorage.removeItem('token');
            }
          } catch (tokenError) {
            console.error('Error parsing token:', tokenError);
            // Clear corrupted token data
            localStorage.removeItem('user');
            localStorage.removeItem('role');
            localStorage.removeItem('token');
          }
        }
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        // Clear corrupted data
        localStorage.removeItem('user');
        localStorage.removeItem('role');
        localStorage.removeItem('token');
      } finally {
        setAuthChecked(true);
      }
    };
    
    checkStoredAuth();
  }, []);

  const login = (userData, userRole, authToken) => {
    console.log('🔐 Logging in user:', userData.name, 'Role:', userRole);
    
    // Clear any existing auth data first to prevent conflicts
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    
    setUser(userData);
    setRole(userRole);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('role', userRole);
    localStorage.setItem('token', authToken);
  };

  const logout = () => {
    console.log('🚪 Logging out user');
    setUser(null);
    setRole(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    
    // Clear any cached data to prevent cross-contamination
    localStorage.removeItem('restaurants');
    localStorage.removeItem('menuItems');
    localStorage.removeItem('tables');
    localStorage.removeItem('orders');
    localStorage.removeItem('bookings');
    localStorage.removeItem('cart');
  };

  // API helper function
  const apiCall = async (endpoint, options = {}) => {
    setIsLoading(true);
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      // Handle network errors gracefully
      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Network error occurred' }));
        
        // Only logout on authentication errors, not on other errors
        if (response.status === 401 && data.message && data.message.includes('token')) {
          console.log('🔒 Token expired or invalid, logging out');
          logout();
        }
        throw new Error(data.message || `API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ API call successful: ${endpoint}`, data.success ? 'Success' : 'Failed');
      return data;
    } catch (error) {
      // Handle network connection errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('⚠️ Network connection error - backend may not be running:', endpoint);
        throw new Error('Unable to connect to server. Please ensure the backend is running.');
      }
      
      // Log other errors for debugging
      if (!error.message.includes('fetch') && !error.message.includes('Network')) {
        console.error(`API call error for ${endpoint}:`, error);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user,
    role,
    token,
    isAuthenticated,
    isLoading,
    authChecked,
    login,
    logout,
    apiCall
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};