import { createContext, useContext, useState, useEffect } from 'react';
import { getReports } from '../services/reportService';
import { getScans } from '../services/scanService';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notifications, setNotifications] = useState({
    activeScans: 0,
    criticalAlerts: 0,
    pendingReports: 0,
    newVulnerabilities: 0,
  });

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setNotifications({
            activeScans: 0,
            criticalAlerts: 0,
            pendingReports: 0,
            newVulnerabilities: 0,
          });
          return;
        }

        const [scanData, reportData] = await Promise.all([
          getScans(1, 100, {}),
          getReports(1, 10),
        ]);

        const scans = scanData.items || [];
        const activeScansCount = scans.filter((item) => ['queued', 'running', 'cancelling'].includes(item.status)).length;

        const criticalAlertsCount = scans.reduce((acc, scan) => {
          const severity = scan?.scan_summary?.severity_counts || {};
          const critical = severity.critical || 0;
          return acc + (critical > 0 ? 1 : 0);
        }, 0);

        const pendingReportsCount = reportData?.total || 0;
        const newVulnerabilitiesCount = scans.reduce((acc, scan) => {
          const severity = scan?.scan_summary?.severity_counts || {};
          return acc + (severity.high || 0) + (severity.critical || 0);
        }, 0);

        setNotifications({
          activeScans: activeScansCount,
          criticalAlerts: criticalAlertsCount,
          pendingReports: pendingReportsCount,
          newVulnerabilities: newVulnerabilitiesCount,
        });
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    // Initial fetch
    fetchNotifications();

    // Update every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const updateNotifications = (newNotifications) => {
    setNotifications(prev => ({ ...prev, ...newNotifications }));
  };

  const clearNotification = (type) => {
    setNotifications(prev => ({ ...prev, [type]: 0 }));
  };

  // Get notification count for a specific route
  const getNotificationCount = (route) => {
    switch (route) {
      case '/':
        return notifications.criticalAlerts;
      case '/scans':
        return notifications.activeScans;
      case '/active-scans':
        return notifications.activeScans;
      case '/reports':
        return notifications.pendingReports;
      case '/completed-scans':
        return notifications.newVulnerabilities;
      default:
        return 0;
    }
  };

  // Get badge variant based on urgency
  const getBadgeVariant = (route) => {
    switch (route) {
      case '/':
        return notifications.criticalAlerts > 0 ? 'destructive' : 'secondary';
      case '/scans':
        return notifications.activeScans > 0 ? 'default' : 'secondary';
      case '/active-scans':
        return 'default';
      case '/reports':
        return 'secondary';
      case '/completed-scans':
        return notifications.newVulnerabilities > 5 ? 'warning' : 'secondary';
      default:
        return 'secondary';
    }
  };

  const value = {
    isCollapsed,
    toggleCollapse,
    notifications,
    updateNotifications,
    clearNotification,
    getNotificationCount,
    getBadgeVariant,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};

export default SidebarContext;