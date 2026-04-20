import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Component for routes that require authentication
const ProtectedRoute = ({ children, requiredRole }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  
  // Check if token exists
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    // If token doesn't exist but currentUser does, logout
    if (!token && currentUser) {
      logout();
    }
  }, [token, currentUser, logout]);

  // If not logged in or no token, redirect to login page
  if (!currentUser || !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is required and user doesn't have it, redirect to dashboard
  if (requiredRole && currentUser.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // If authenticated and has required role (or no role required), render children
  return children;
};

export default ProtectedRoute;