import { toast as hotToast } from 'react-hot-toast';

/**
 * Custom toast function that wraps react-hot-toast with predefined styles
 * @param {Object} options - Toast options
 * @param {string} options.title - Toast title
 * @param {string} options.description - Toast description
 * @param {string} options.variant - Toast variant (default, success, destructive)
 * @param {number} options.duration - Toast duration in milliseconds
 */
export const toast = ({
  title,
  description,
  variant = 'default',
  duration = 3000,
}) => {
  const getStyle = () => {
    switch (variant) {
      case 'success':
        return {
          style: {
            background: '#10B981',
            color: 'white',
          },
          icon: '✅',
        };
      case 'destructive':
        return {
          style: {
            background: '#EF4444',
            color: 'white',
          },
          icon: '❌',
        };
      default:
        return {
          style: {
            background: '#1E293B',
            color: 'white',
          },
          icon: 'ℹ️',
        };
    }
  };

  const { style, icon } = getStyle();

  return hotToast(
    (t) => (
      <div className="flex items-start">
        <div className="text-lg mr-2">{icon}</div>
        <div>
          {title && <p className="font-medium">{title}</p>}
          {description && <p className="text-sm opacity-90">{description}</p>}
        </div>
      </div>
    ),
    {
      duration,
      style: {
        ...style,
        padding: '12px 16px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        maxWidth: '350px',
      },
    }
  );
};