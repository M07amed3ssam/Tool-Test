// User role enum for frontend
export const UserRole = {
  ADMIN: 'admin',
  USER: 'user'
};

// Helper function to check if user has admin role
export const isAdmin = (role) => role === UserRole.ADMIN;

// Helper function to check if user has specific role
export const hasRole = (userRole, requiredRole) => userRole === requiredRole;
