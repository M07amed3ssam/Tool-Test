import { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '../lib/apiBaseUrl';

// Create the auth context
const AuthContext = createContext(null);

const API_URL = getApiBaseUrl();

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem('token');

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in from localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Login function
  const login = (email, password) => {
    return new Promise((resolve, reject) => {
      // Create FormData object for OAuth2 compatibility
      const formData = new FormData();
      formData.append('username', email); // OAuth2 uses username field for email
      formData.append('password', password);

      fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        // Don't set Content-Type header, browser will set it with boundary for FormData
        body: formData,
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Invalid email or password');
          }
          return response.json();
        })
        .then((data) => {
          // Store the token
          localStorage.setItem('token', data.access_token);
          
          // Fetch user data with the token
          return fetch(`${API_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${data.access_token}`
            }
          });
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch user data');
          }
          return response.json();
        })
        .then(userData => {
          const user = {
            id: userData.id,
            email: userData.email,
            name: userData.username,
            role: userData.role,
          };
          
          // Store user info
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('userRole', user.role);
          
          setCurrentUser(user);
          resolve(user);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Register function
  const register = (email, password, name) => {
    return new Promise((resolve, reject) => {
      fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          username: name,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Registration failed');
          }
          return response.json();
        })
        .then((data) => {
          // After successful registration, log the user in
          return login(email, password);
        })
        .then((user) => {
          resolve(user);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Logout function
  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userRole');
  };

  // Reset password function (placeholder for future implementation)
  const resetPassword = (email) => {
    return new Promise((resolve, reject) => {
      // This would connect to a real API endpoint in the future
      reject(new Error('Password reset functionality not implemented yet'));
    });
  };

  // Update password function
  const updatePassword = (currentPassword, newPassword) => {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      if (!token) {
        reject(new Error('Authentication token not found'));
        return;
      }

      fetch(`${API_URL}/auth/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        }),
      })
        .then((response) => {
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Current password is incorrect');
            }
            throw new Error('Failed to update password');
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Create user function (admin only)
  const createUser = (userData) => {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      if (!token) {
        reject(new Error('Authentication token not found'));
        return;
      }

      fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to create user');
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Get all users function (admin only)
  const getAllUsers = () => {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      if (!token) {
        reject(new Error('Authentication token not found'));
        return;
      }

      fetch(`${API_URL}/auth/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to fetch users');
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Update user role function (admin only)
  const updateUserRole = (userId, role) => {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      if (!token) {
        reject(new Error('Authentication token not found'));
        return;
      }

      fetch(`${API_URL}/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to update user role');
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  // Delete user function (admin only)
  const deleteUser = (userId) => {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      if (!token) {
        reject(new Error('Authentication token not found'));
        return;
      }

      fetch(`${API_URL}/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to delete user');
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  };

  const value = {
    currentUser,
    login,
    register,
    logout,
    resetPassword,
    updatePassword,
    createUser,
    getAllUsers,
    updateUserRole,
    deleteUser,
    isAdmin: currentUser?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};