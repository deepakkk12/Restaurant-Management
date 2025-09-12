import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};


export const DataProvider = ({ children }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { apiCall, isAuthenticated, authChecked, token } = useAuth();

  // Load data from localStorage on mount
  useEffect(() => {
    const loadStoredData = () => {
      // Only load stored data if user role is appropriate
      if (!role) return;
      
      try {
        // Load role-specific data
        let storedRestaurants, storedOrders, storedBookings, storedCart;
        
        if (role === 'customer') {
          storedRestaurants = localStorage.getItem('restaurants');
          storedOrders = localStorage.getItem('orders');
          storedBookings = localStorage.getItem('bookings');
          storedCart = localStorage.getItem('cart');
        }
        
        if (storedRestaurants && role === 'customer') {
          setRestaurants(JSON.parse(storedRestaurants));
        }
        if (storedOrders && role === 'customer') {
          setOrders(JSON.parse(storedOrders));
        }
        if (storedBookings && role === 'customer') {
          setBookings(JSON.parse(storedBookings));
        }
        if (storedCart && role === 'customer') {
          setCart(JSON.parse(storedCart));
        }
        
        console.log(`📦 ${role} data restored from localStorage`);
      } catch (error) {
        console.error('Error loading stored data:', error);
      }
    };
    
    loadStoredData();
  }, [role]); // Re-run when role changes

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (restaurants.length > 0 && role === 'customer') {
      localStorage.setItem('restaurants', JSON.stringify(restaurants));
    }
  }, [restaurants, role]);

  useEffect(() => {
    if (orders.length > 0 && role === 'customer') {
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  }, [orders, role]);

  useEffect(() => {
    if (bookings.length > 0 && role === 'customer') {
      localStorage.setItem('bookings', JSON.stringify(bookings));
    }
  }, [bookings, role]);

  useEffect(() => {
    if (role === 'customer') {
      localStorage.setItem('cart', JSON.stringify(cart));
    }
  }, [cart, role]);
  // Load restaurants from API
  const loadRestaurants = async () => {
    setIsLoading(true);
    try {
      const result = await apiCall('/restaurants');
      if (result && result.success) {
        setRestaurants(result.data);
        setDataLoaded(true);
        console.log('🏪 Restaurants loaded from API');
        // Only store restaurants data for customers, not admins
        if (role === 'customer') {
          localStorage.setItem('restaurants', JSON.stringify(result.data));
        }
      } else if (result && result.data) {
        setRestaurants(result.data);
        setDataLoaded(true);
        if (role === 'customer') {
          localStorage.setItem('restaurants', JSON.stringify(result.data));
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load restaurants from API:', error.message);
      // Don't clear existing data on network errors
      if (restaurants.length === 0 && role === 'customer') {
        // Try to load from localStorage first
        const storedRestaurants = localStorage.getItem('restaurants');
        if (storedRestaurants) {
          try {
            const parsedRestaurants = JSON.parse(storedRestaurants);
            setRestaurants(parsedRestaurants);
            setDataLoaded(true);
            console.log('📦 Restaurants restored from localStorage');
            return;
          } catch (parseError) {
            console.error('Error parsing stored restaurants:', parseError);
          }
        }
        
        // Set fallback data if no stored data exists
        setRestaurants([
          {
            id: 1,
            name: 'The Golden Spoon',
            cuisine: 'Fine Dining',
            rating: 4.8,
            image: 'https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg',
            address: '123 Gourmet Street, Downtown',
            phone: '+1 (555) 123-4567',
            description: 'Exquisite fine dining experience with contemporary cuisine',
            tables: [],
            total_tables: 20,
            available_tables: 12
          },
          {
            id: 2,
            name: 'Sakura Sushi',
            cuisine: 'Japanese',
            rating: 4.6,
            image: 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg',
            address: '456 Zen Garden Ave, Midtown',
            phone: '+1 (555) 234-5678',
            description: 'Authentic Japanese cuisine with fresh sushi and sashimi',
            tables: [],
            total_tables: 15,
            available_tables: 8
          },
          {
            id: 3,
            name: "Mama's Italian",
            cuisine: 'Italian',
            rating: 4.7,
            image: 'https://images.pexels.com/photos/315755/pexels-photo-315755.jpeg',
            address: '789 Pasta Lane, Little Italy',
            phone: '+1 (555) 345-6789',
            description: 'Traditional Italian flavors in a cozy family atmosphere',
            tables: [],
            total_tables: 18,
            available_tables: 10
          }
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load restaurants when authentication is ready
  React.useEffect(() => {
    if (authChecked) {
      // Only load restaurants for customers and when role is properly set
      if (role === 'customer') {
        loadRestaurants();
      }
      
      // Set up periodic refresh only if authenticated
      let interval; 
      if (isAuthenticated && token && role === 'customer') {
        interval = setInterval(() => {
          loadRestaurants();
        }, 30000); // Refresh every 30 seconds
      }
      return () => clearInterval(interval);
    }
  }, [authChecked, isAuthenticated, token, role]);
  
  // Force reload restaurants data
  const forceLoadRestaurants = async () => {
    console.log('🔄 Force reloading restaurants data...');
    await loadRestaurants();
  };

  // Admin functionality
  const updateRestaurant = (restaurantId, updates) => {
    setRestaurants(prev => prev.map(restaurant => 
      restaurant.id === restaurantId ? { ...restaurant, ...updates } : restaurant
    ));
  };

  const addToCart = (item, restaurantId) => {
    setCart(prev => [...prev, { ...item, restaurantId, id: Date.now() }]);
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const addBooking = (booking) => {
    setBookings(prev => [...prev, { ...booking, id: Date.now(), status: 'confirmed' }]);
  };

  const updateTableStatus = (restaurantId, tableId, status) => {
    setRestaurants(prev => prev.map(restaurant => {
      if (restaurant.id === restaurantId) {
        return {
          ...restaurant,
          tables: restaurant.tables.map(table => 
            table.id === tableId ? { ...table, status } : table
          )
        };
      }
      return restaurant;
    }));
  };

  const loadUserOrders = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      const result = await apiCall('/orders');
      if (result && result.success) {
        setOrders(result.data);
        console.log('📋 Orders loaded from API');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load orders:', error.message);
    }
  };

  const loadUserBookings = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      const result = await apiCall('/bookings');
      if (result && result.success) {
        setBookings(result.data);
        console.log('📅 Bookings loaded from API');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load bookings:', error.message);
    }
  };

  const value = {
    restaurants,
    isLoading,
    dataLoaded,
    loadRestaurants,
    orders,
    bookings,
    cart,
    updateRestaurant,
    addToCart,
    removeFromCart,
    clearCart,
    addBooking,
    updateTableStatus,
    loadUserOrders,
    loadUserBookings,
    forceLoadRestaurants
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};