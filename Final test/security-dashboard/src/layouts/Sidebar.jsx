import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { UserRole } from '../types/roles';
import {
  LayoutDashboard,
  Scan,
  FileText,
  Settings,
  Users,
  LogOut,
  Shield,
  PlusCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';
import { Badge } from '../components/ui/badge';

const Sidebar = ({ className, mobile = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const { 
    isCollapsed, 
    toggleCollapse, 
    getNotificationCount, 
    getBadgeVariant,
    notifications 
  } = useSidebar();
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard className="h-5 w-5" />,
      description: 'Security overview',
      hasNotification: notifications.criticalAlerts > 0,
    },
    {
      name: 'New Scan',
      href: '/new-scan',
      icon: <PlusCircle className="h-5 w-5" />,
      description: 'Start security scan',
      hasNotification: false,
    },
    {
      name: 'Scans',
      href: '/scans',
      icon: <Scan className="h-5 w-5" />,
      description: 'Monitor scan jobs',
      hasNotification: notifications.activeScans > 0,
    },
    {
      name: 'Active Scans',
      href: '/active-scans',
      icon: <Scan className="h-5 w-5" />,
      description: 'Running scans',
      hasNotification: notifications.activeScans > 0,
    },
    {
      name: 'Completed Scans',
      href: '/completed-scans',
      icon: <CheckCircle className="h-5 w-5" />,
      description: 'Finished scans',
      hasNotification: notifications.newVulnerabilities > 0,
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: <FileText className="h-5 w-5" />,
      description: 'Vulnerability reports',
      hasNotification: notifications.pendingReports > 0,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: <Settings className="h-5 w-5" />,
      description: 'System settings',
      hasNotification: false,
    },
  ];

  // Admin-only navigation items
  const adminItems = [
    {
      name: 'Admin Panel',
      href: '/admin',
      icon: <Users className="h-5 w-5" />,
      description: 'User management',
      hasNotification: false,
    },
  ];

  // Development item (remove in production)
  const devItems = [
    {
      name: 'Style Demo',
      href: '/style-demo',
      icon: <Eye className="h-5 w-5" />,
      description: 'UI components demo',
      hasNotification: false,
    },
  ];

  const NavItem = ({ item, isActive }) => {
    const badgeCount = getNotificationCount(item.href);
    const badgeVariant = getBadgeVariant(item.href);

    return (
      <Link
        to={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative",
          "hover:bg-accent/50 hover:shadow-sm hover:-translate-y-0.5",
          "active:scale-95", // Mobile touch feedback
          isActive
            ? "bg-primary text-primary-foreground font-medium shadow-md"
            : "text-muted-foreground hover:text-foreground",
          mobile && "py-3" // Larger touch targets on mobile
        )}
        title={isCollapsed && !mobile ? item.name : undefined}
      >
        <div className="relative">
          {item.icon}
          {item.hasNotification && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-destructive rounded-full animate-pulse" />
          )}
        </div>
        
        {(!isCollapsed || mobile) && (
          <>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.name}</div>
              {!isActive && !mobile && (
                <div className="text-xs text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.description}
                </div>
              )}
            </div>
            
            {badgeCount && (
              <Badge 
                variant={badgeVariant} 
                className="h-5 text-xs min-w-5 px-1.5 animate-fade-in flex-shrink-0"
              >
                {badgeCount > 99 ? '99+' : badgeCount}
              </Badge>
            )}
          </>
        )}

        {/* Collapsed tooltip - only for desktop */}
        {isCollapsed && !mobile && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
            {item.name}
            {badgeCount && (
              <Badge variant={badgeVariant} className="ml-2 h-4 text-xs">
                {badgeCount}
              </Badge>
            )}
          </div>
        )}
      </Link>
    );
  };

  const isItemActive = (href) => {
    if (href === '/') {
      return location.pathname === '/';
    }

    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-border/50 transition-all duration-300 relative",
      !mobile && (isCollapsed ? "w-16" : "w-64"),
      mobile && "w-full",
      className
    )}>
      {/* Header - Hide collapse button on mobile */}
      <div className={cn(
        "p-4 flex items-center border-b border-border/50 relative",
        mobile ? "justify-start" : (isCollapsed ? "justify-center" : "justify-between")
      )}>
        <div className={cn("flex items-center gap-2", !mobile && isCollapsed && "justify-center")}>
          {/* Try to use logo.png if available, fallback to Shield icon */}
          <div className="h-6 w-6 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Sub-lZer0 Logo" 
              className="h-6 w-6 object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <Shield className="h-6 w-6 text-primary animate-security-pulse hidden" />
          </div>
          {(!isCollapsed || mobile) && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Sub-lZer0
            </h1>
          )}
        </div>
        
        {/* Collapse Toggle - Desktop only */}
        {!mobile && (
          <button
            onClick={toggleCollapse}
            className={cn(
              "p-1.5 rounded-md hover:bg-accent/50 transition-colors",
              isCollapsed && "absolute -right-3 top-1/2 -translate-y-1/2 bg-background border border-border shadow-md z-10"
            )}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <div className="flex flex-col flex-1 p-3 space-y-1 overflow-hidden">
        {/* Main Navigation */}
        <div className="space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isItemActive(item.href)}
            />
          ))}
        </div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className={cn(
              "h-px bg-border/50 my-3",
              isCollapsed && !mobile && "mx-2"
            )} />
            <div className="space-y-1">
              {(!isCollapsed || mobile) && (
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Administration
                </div>
              )}
              {adminItems.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                />
              ))}
            </div>
          </>
        )}

        {/* Development Section (Remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <div className={cn(
              "h-px bg-border/50 my-3",
              isCollapsed && !mobile && "mx-2"
            )} />
            <div className="space-y-1">
              {(!isCollapsed || mobile) && (
                <div className="px-3 py-1 text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                  Development
                </div>
              )}
              {devItems.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* User Section & Logout */}
      <div className="p-3 border-t border-border/50 mt-auto space-y-2">
        {/* User Info */}
        {(!isCollapsed || mobile) && currentUser && (
          <div className="px-3 py-2 rounded-lg bg-accent/30 mb-2">
            <div className="text-sm font-medium truncate">{currentUser.name}</div>
            <div className="text-xs text-muted-foreground truncate">{currentUser.email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              <Badge variant="outline" className="text-xs h-5">
                {currentUser.role}
              </Badge>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 w-full text-left group",
            "text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:shadow-sm",
            "active:scale-95", // Mobile touch feedback
            mobile && "py-3", // Larger touch target on mobile
            !mobile && isCollapsed && "justify-center"
          )}
          title={isCollapsed && !mobile ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 group-hover:text-destructive transition-colors" />
          {(!isCollapsed || mobile) && (
            <span className="group-hover:text-destructive transition-colors">Logout</span>
          )}
          
          {/* Collapsed tooltip - Desktop only */}
          {isCollapsed && !mobile && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap">
              Logout
            </div>
          )}
        </button>
      </div>

      {/* Status Indicator */}
      <div className={cn(
        "absolute bottom-2 left-2 right-2 h-1 rounded-full bg-gradient-to-r",
        notifications.criticalAlerts > 0 
          ? "from-destructive to-destructive/50 animate-pulse" 
          : notifications.activeScans > 0 
          ? "from-warning to-warning/50" 
          : "from-success to-success/50"
      )} />
    </div>
  );
};

export default Sidebar;