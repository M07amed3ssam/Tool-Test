import { ChevronDown, User, Settings, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/roles';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import NotificationsPopover from '../components/NotificationsPopover';
import ThemeToggle from '../components/ThemeToggle';

const Topbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  
  const user = {
    name: currentUser?.name || 'User',
    email: currentUser?.email || 'user@example.com',
    role: currentUser?.role || UserRole.USER,
    avatar: null,
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleProfileClick = () => {
    navigate('/settings'); 
  };

  // Get page title from current route
  const getPageTitle = () => {
    const path = location.pathname;

    if (path.startsWith('/scans/')) {
      return 'Scan Details';
    }

    if (path.startsWith('/reports/')) {
      return 'Report Details';
    }

    switch (path) {
      case '/':
        return 'Dashboard';
      case '/new-scan':
        return 'New Scan';
      case '/scans':
        return 'Scans';
      case '/active-scans':
        return 'Active Scans';
      case '/completed-scans':
        return 'Completed Scans';
      case '/reports':
        return 'Reports';
      case '/settings':
        return 'Settings';
      case '/admin':
        return 'Admin Panel';
      case '/style-demo':
        return 'Style Demo';
      default:
        return 'Sub-lZer0';
    }
  };

  // Mock notifications data
  const mockNotifications = [
    {
      id: 1,
      type: 'vulnerability_found',
      severity: 'critical',
      message: 'Critical vulnerability detected in Server-01',
      time: '5 minutes ago',
      read: false
    },
    {
      id: 2,
      type: 'scan_completed',
      severity: 'high',
      message: 'Scan completed for Web Application',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      type: 'scan_started',
      severity: 'medium',
      message: 'Scheduled scan started for Database Server',
      time: '3 hours ago',
      read: true
    },
    {
      id: 4,
      type: 'scan_completed',
      severity: 'low',
      message: 'Low-risk informational scan update for API Gateway',
      time: '6 hours ago',
      read: true
    }
  ];

  return (
    <div className="w-full flex items-center justify-between">
      {/* Page Title - Responsive */}
      <div className="flex-1 min-w-0">
        <h2 className="text-xl md:text-2xl font-semibold truncate text-responsive-lg">
          {getPageTitle()}
        </h2>
      </div>

      {/* Action Items - Responsive Layout */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {/* Theme Toggle */}
        <ThemeToggle />
        
        {/* Notifications */}
        <NotificationsPopover notifications={mockNotifications} />

        {/* User Profile - Mobile Responsive */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-1 md:gap-2 p-1 md:p-2">
              <Avatar className="h-7 w-7 md:h-8 md:w-8">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="text-xs md:text-sm">
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {/* Hide name on very small screens */}
              <div className="hidden sm:flex items-center">
                <span className="text-sm font-medium truncate max-w-24 md:max-w-none">
                  {user.name}
                </span>
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4 ml-1" />
              </div>
              {/* Show only chevron on small screens */}
              <ChevronDown className="h-4 w-4 sm:hidden" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {user.email}
                </span>
                <span className="text-xs font-medium bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-sm w-fit">
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfileClick} className="cursor-pointer">
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettingsClick} className="cursor-pointer">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default Topbar;