import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Clock, AlertTriangle, CheckCircle, PauseCircle } from 'lucide-react';

const ScanJobCard = ({ scan, onViewDetails }) => {
  // Function to determine status icon
  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'in progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Function to determine progress color
  const getProgressColor = (status) => {
    switch (status.toLowerCase()) {
      case 'in progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Function to determine severity badge color
  const getSeverityColor = (count, type) => {
    if (count === 0) return 'bg-gray-500';
    
    switch (type.toLowerCase()) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="pt-6">
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-lg">{scan.name}</h3>
            <div className="flex items-center space-x-1">
              {getStatusIcon(scan.status)}
              <span className="text-sm">{scan.status}</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-2">{scan.target}</p>
          <div className="flex justify-between text-xs text-gray-500 mb-3">
            <span>Started: {formatDate(scan.startTime)}</span>
            {scan.endTime && <span>Ended: {formatDate(scan.endTime)}</span>}
          </div>
          
          {scan.progress < 100 && scan.status.toLowerCase() !== 'completed' && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Progress</span>
                <span>{scan.progress}%</span>
              </div>
              <Progress 
                value={scan.progress} 
                className="h-2" 
                indicatorClassName={getProgressColor(scan.status)}
              />
            </div>
          )}
        </div>
        
        {/* Vulnerabilities summary */}
        {scan.vulnerabilities && (
          <div className="flex space-x-2 mb-2">
            {scan.vulnerabilities.critical > 0 && (
              <Badge className={getSeverityColor(scan.vulnerabilities.critical, 'critical')}>
                {scan.vulnerabilities.critical} Critical
              </Badge>
            )}
            {scan.vulnerabilities.high > 0 && (
              <Badge className={getSeverityColor(scan.vulnerabilities.high, 'high')}>
                {scan.vulnerabilities.high} High
              </Badge>
            )}
            {scan.vulnerabilities.medium > 0 && (
              <Badge className={getSeverityColor(scan.vulnerabilities.medium, 'medium')}>
                {scan.vulnerabilities.medium} Medium
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full" 
          onClick={() => onViewDetails(scan.id)}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScanJobCard;