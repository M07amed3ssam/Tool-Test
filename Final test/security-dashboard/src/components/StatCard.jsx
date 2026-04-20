import { Card, CardContent } from './ui/card';

const StatCard = ({ title, value, icon, description, trend, trendValue, className }) => {
  // Function to determine trend color and icon
  const getTrendDetails = () => {
    if (!trend) return { color: 'text-gray-500', icon: null };
    
    if (trend === 'up') {
      return { 
        color: 'text-green-500', 
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
          </svg>
        ) 
      };
    } else {
      return { 
        color: 'text-red-500', 
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
          </svg>
        ) 
      };
    }
  };
  
  const trendDetails = getTrendDetails();
  
  return (
    <Card className={`shadow-sm ${className || ''}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h4 className="text-2xl font-bold mt-1">{value}</h4>
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          {icon && (
            <div className="p-2 rounded-full bg-gray-100">
              {icon}
            </div>
          )}
        </div>
        
        {trend && trendValue && (
          <div className="flex items-center mt-4">
            <span className={`flex items-center ${trendDetails.color}`}>
              {trendDetails.icon}
              <span className="ml-1 text-sm font-medium">{trendValue}</span>
            </span>
            <span className="ml-2 text-xs text-muted-foreground">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatCard;