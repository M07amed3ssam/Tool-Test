import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit, Search, Shield, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { useAuth } from '../context/AuthContext';

// Mock data for system settings
const mockSystemSettings = {
  scanSettings: {
    maxConcurrentScans: 3,
    defaultScanTimeout: 60, // minutes
    enableAutoScan: true,
    scanFrequency: 'weekly',
  },
  securitySettings: {
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      passwordExpiry: 90, // days
    },
    sessionTimeout: 30, // minutes
    maxLoginAttempts: 5,
    twoFactorAuth: true,
  },
  notificationSettings: {
    emailServer: 'smtp.company.com',
    emailPort: 587,
    emailSender: 'security-dashboard@company.com',
    enableSlackNotifications: true,
    slackWebhook: 'https://hooks.slack.com/services/XXX/YYY/ZZZ',
  },
};

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [systemSettings, setSystemSettings] = useState(mockSystemSettings);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    username: '',
    password: '',
    role: 'USER'
  });
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const { getAllUsers, createUser, updateUserRole: authUpdateUserRole, deleteUser: authDeleteUser } = useAuth();

  // Fetch users from API
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        const data = await getAllUsers();
        
        // Transform the data to match our component's expected format
        const formattedUsers = data.map(user => ({
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          lastActive: user.created_at,
          status: 'active'
        }));
        
        setUsers(formattedUsers);
        setError(null);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [getAllUsers]);

  const filteredUsers = users.filter(user => 
    (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  // Function to update user role
  const updateUserRole = async (userId, newRole) => {
    try {
      await authUpdateUserRole(userId, newRole);
      
      // Update the local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user role:', err);
      setError(err.message);
    }
  };
  
  // Function to delete user
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      await authDeleteUser(userId);
      
      // Update the local state
      setUsers(users.filter(user => user.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const handleSystemSettingChange = (category, setting, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value,
      },
    }));
  };

  // Handle input change for new user form
  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle create user form submission
  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const createdUser = await createUser(newUser);
      
      // Add the new user to the list
      const formattedUser = {
        id: createdUser.id,
        name: createdUser.username,
        email: createdUser.email,
        role: createdUser.role,
        lastActive: createdUser.created_at,
        status: 'active'
      };
      
      setUsers([...users, formattedUser]);
      
      // Reset form
      setNewUser({
        email: '',
        username: '',
        password: '',
        role: 'USER'
      });
      
      setShowCreateForm(false);
      setError(null);
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.message);
    }
  };

  const handlePasswordPolicyChange = (setting, value) => {
    setSystemSettings(prev => ({
      ...prev,
      securitySettings: {
        ...prev.securitySettings,
        passwordPolicy: {
          ...prev.securitySettings.passwordPolicy,
          [setting]: value,
        },
      },
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Administration</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="settings">System Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="users" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="pl-8 h-9 w-[250px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {showCreateForm ? 'Cancel' : 'Add User'}
                </Button>
              </div>
              
              {showCreateForm && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle>Create New User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium">Email</label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newUser.email}
                            onChange={handleNewUserChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="username" className="text-sm font-medium">Username</label>
                          <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newUser.username}
                            onChange={handleNewUserChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="password" className="text-sm font-medium">Password</label>
                          <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newUser.password}
                            onChange={handleNewUserChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <label htmlFor="role" className="text-sm font-medium">Role</label>
                          <select
                            id="role"
                            name="role"
                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                            value={newUser.role}
                            onChange={handleNewUserChange}
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit">
                          Create User
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar>
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {editingUser === user.id ? (
                            <div className="flex items-center space-x-2">
                              <select 
                                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                defaultValue={user.role}
                                onChange={(e) => updateUserRole(user.id, e.target.value)}
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              {user.role === 'admin' ? (
                                <span className="flex items-center text-sm font-medium text-primary">
                                  <Shield className="mr-1 h-3 w-3" />
                                  Admin
                                </span>
                              ) : (
                                <span className="text-sm">User</span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(user.lastActive)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setEditingUser(user.id)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-6 pt-4">
              {/* Scan Settings */}
              <div>
                <h3 className="text-lg font-medium mb-4">Scan Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="maxConcurrentScans" className="text-sm font-medium">
                        Max Concurrent Scans
                      </label>
                      <input
                        id="maxConcurrentScans"
                        type="number"
                        value={systemSettings.scanSettings.maxConcurrentScans}
                        onChange={(e) => handleSystemSettingChange('scanSettings', 'maxConcurrentScans', parseInt(e.target.value))}
                        className="w-full p-2 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="defaultScanTimeout" className="text-sm font-medium">
                        Default Scan Timeout (minutes)
                      </label>
                      <input
                        id="defaultScanTimeout"
                        type="number"
                        value={systemSettings.scanSettings.defaultScanTimeout}
                        onChange={(e) => handleSystemSettingChange('scanSettings', 'defaultScanTimeout', parseInt(e.target.value))}
                        className="w-full p-2 rounded-md border border-input bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      id="enableAutoScan"
                      type="checkbox"
                      checked={systemSettings.scanSettings.enableAutoScan}
                      onChange={(e) => handleSystemSettingChange('scanSettings', 'enableAutoScan', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="enableAutoScan" className="text-sm font-medium">
                      Enable Automatic Scanning
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="scanFrequency" className="text-sm font-medium">
                      Scan Frequency
                    </label>
                    <select
                      id="scanFrequency"
                      value={systemSettings.scanSettings.scanFrequency}
                      onChange={(e) => handleSystemSettingChange('scanSettings', 'scanFrequency', e.target.value)}
                      className="w-full p-2 rounded-md border border-input bg-background"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Security Settings */}
              <div>
                <h3 className="text-lg font-medium mb-4">Security Settings</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Password Policy</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="minLength" className="text-sm">
                          Minimum Password Length
                        </label>
                        <input
                          id="minLength"
                          type="number"
                          value={systemSettings.securitySettings.passwordPolicy.minLength}
                          onChange={(e) => handlePasswordPolicyChange('minLength', parseInt(e.target.value))}
                          className="w-full p-2 rounded-md border border-input bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="passwordExpiry" className="text-sm">
                          Password Expiry (days)
                        </label>
                        <input
                          id="passwordExpiry"
                          type="number"
                          value={systemSettings.securitySettings.passwordPolicy.passwordExpiry}
                          onChange={(e) => handlePasswordPolicyChange('passwordExpiry', parseInt(e.target.value))}
                          className="w-full p-2 rounded-md border border-input bg-background"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <input
                          id="requireUppercase"
                          type="checkbox"
                          checked={systemSettings.securitySettings.passwordPolicy.requireUppercase}
                          onChange={(e) => handlePasswordPolicyChange('requireUppercase', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="requireUppercase" className="text-sm">
                          Require Uppercase
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id="requireLowercase"
                          type="checkbox"
                          checked={systemSettings.securitySettings.passwordPolicy.requireLowercase}
                          onChange={(e) => handlePasswordPolicyChange('requireLowercase', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="requireLowercase" className="text-sm">
                          Require Lowercase
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id="requireNumbers"
                          type="checkbox"
                          checked={systemSettings.securitySettings.passwordPolicy.requireNumbers}
                          onChange={(e) => handlePasswordPolicyChange('requireNumbers', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="requireNumbers" className="text-sm">
                          Require Numbers
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          id="requireSpecialChars"
                          type="checkbox"
                          checked={systemSettings.securitySettings.passwordPolicy.requireSpecialChars}
                          onChange={(e) => handlePasswordPolicyChange('requireSpecialChars', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="requireSpecialChars" className="text-sm">
                          Require Special Characters
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="sessionTimeout" className="text-sm font-medium">
                        Session Timeout (minutes)
                      </label>
                      <input
                        id="sessionTimeout"
                        type="number"
                        value={systemSettings.securitySettings.sessionTimeout}
                        onChange={(e) => handleSystemSettingChange('securitySettings', 'sessionTimeout', parseInt(e.target.value))}
                        className="w-full p-2 rounded-md border border-input bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="maxLoginAttempts" className="text-sm font-medium">
                        Max Login Attempts
                      </label>
                      <input
                        id="maxLoginAttempts"
                        type="number"
                        value={systemSettings.securitySettings.maxLoginAttempts}
                        onChange={(e) => handleSystemSettingChange('securitySettings', 'maxLoginAttempts', parseInt(e.target.value))}
                        className="w-full p-2 rounded-md border border-input bg-background"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      id="twoFactorAuth"
                      type="checkbox"
                      checked={systemSettings.securitySettings.twoFactorAuth}
                      onChange={(e) => handleSystemSettingChange('securitySettings', 'twoFactorAuth', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="twoFactorAuth" className="text-sm font-medium">
                      Require Two-Factor Authentication
                    </label>
                  </div>
                </div>
              </div>
              
              <Button className="mt-4">
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;