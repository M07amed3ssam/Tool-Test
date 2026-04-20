import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ScrollArea } from './ui/scroll-area';

const SEVERITY_META = {
  critical: {
    label: 'Critical',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    badge: 'bg-red-100 text-red-700 border-red-200',
    unreadBg: 'bg-red-50',
    border: 'border-red-300',
  },
  high: {
    label: 'High',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    unreadBg: 'bg-orange-50',
    border: 'border-orange-300',
  },
  medium: {
    label: 'Medium',
    iconBg: 'bg-yellow-100',
    iconText: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    unreadBg: 'bg-yellow-50',
    border: 'border-yellow-300',
  },
  low: {
    label: 'Low',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    badge: 'bg-green-100 text-green-700 border-green-200',
    unreadBg: 'bg-green-50',
    border: 'border-green-300',
  },
  info: {
    label: 'Info',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    unreadBg: 'bg-blue-50',
    border: 'border-blue-300',
  },
};

const resolveSeverity = (notification) => {
  const rawSeverity = String(notification?.severity || '').trim().toLowerCase();
  if (SEVERITY_META[rawSeverity]) {
    return rawSeverity;
  }

  if (notification?.type === 'vulnerability_found') {
    return 'critical';
  }

  return 'info';
};

const NotificationsPopover = ({ notifications = [] }) => {
  const [unreadCount, setUnreadCount] = useState(notifications.filter(n => !n.read).length);
  const [notificationsList, setNotificationsList] = useState(notifications);

  // Function to mark a notification as read
  const markAsRead = (id) => {
    setNotificationsList(notificationsList.map(notification => {
      if (notification.id === id && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        return { ...notification, read: true };
      }
      return notification;
    }));
  };

  // Function to mark all notifications as read
  const markAllAsRead = () => {
    setNotificationsList(notificationsList.map(notification => {
      return { ...notification, read: true };
    }));
    setUnreadCount(0);
  };

  // Function to determine notification icon
  const getNotificationIcon = (type, severity) => {
    const severityMeta = SEVERITY_META[severity] || SEVERITY_META.info;

    switch (type) {
      case 'scan_completed':
        return (
          <div className={`rounded-full p-2 ${severityMeta.iconBg}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${severityMeta.iconText}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'vulnerability_found':
        return (
          <div className={`rounded-full p-2 ${severityMeta.iconBg}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${severityMeta.iconText}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'scan_started':
        return (
          <div className={`rounded-full p-2 ${severityMeta.iconBg}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${severityMeta.iconText}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return (
          <div className={`rounded-full p-2 ${severityMeta.iconBg}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${severityMeta.iconText}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8">
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notificationsList.length > 0 ? (
            <div className="divide-y">
              {notificationsList.map((notification) => {
                const severity = resolveSeverity(notification);
                const severityMeta = SEVERITY_META[severity] || SEVERITY_META.info;

                return (
                <div
                  key={notification.id}
                  className={`p-4 flex items-start gap-3 border-l-4 ${severityMeta.border} ${!notification.read ? severityMeta.unreadBg : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  {getNotificationIcon(notification.type, severity)}
                  <div className="flex-1">
                    <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
                      {notification.message}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityMeta.badge}`}>
                        {severityMeta.label}
                      </span>
                      <p className="text-xs text-gray-500">{notification.time}</p>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p>No notifications</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPopover;