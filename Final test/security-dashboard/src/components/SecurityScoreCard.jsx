import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

const SecurityScoreCard = ({ score, previousScore, metrics }) => {
  // Function to determine score color
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Function to determine progress color
  const getProgressColor = (score) => {
    if (score >= 90) return 'bg-green-600';
    if (score >= 70) return 'bg-blue-600';
    if (score >= 50) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  // Function to calculate score change
  const getScoreChange = () => {
    if (previousScore === undefined || previousScore === null) return null;
    
    const change = score - previousScore;
    return {
      value: Math.abs(change).toFixed(1),
      direction: change >= 0 ? 'up' : 'down',
      color: change >= 0 ? 'text-green-600' : 'text-red-600',
      icon: change >= 0 ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586l-4.293-4.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
        </svg>
      )
    };
  };

  const scoreChange = getScoreChange();

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Security Score</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center p-4">
          <div className="relative w-40 h-40 mb-4">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</div>
                <div className="text-sm text-muted-foreground">out of 100</div>
              </div>
            </div>
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle
                className="text-gray-200"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
              />
              <circle
                className={getProgressColor(score)}
                strokeWidth="8"
                strokeDasharray={`${score * 2.51} 251.2`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="40"
                cx="50"
                cy="50"
                transform="rotate(-90 50 50)"
              />
            </svg>
          </div>

          {scoreChange && (
            <div className={`flex items-center ${scoreChange.color} mb-4`}>
              {scoreChange.icon}
              <span className="ml-1">
                {scoreChange.value} points {scoreChange.direction === 'up' ? 'increase' : 'decrease'}
              </span>
            </div>
          )}

          {metrics && metrics.length > 0 && (
            <div className="w-full space-y-3 mt-4">
              {metrics.map((metric, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{metric.name}</span>
                    <span className={getScoreColor(metric.score)}>{metric.score}/100</span>
                  </div>
                  <Progress 
                    value={metric.score} 
                    className="h-2" 
                    indicatorClassName={getProgressColor(metric.score)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityScoreCard;