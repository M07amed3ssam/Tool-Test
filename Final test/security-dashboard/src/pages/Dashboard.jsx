import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Shield, AlertTriangle, CheckCircle, Clock, Loader2, PlusCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import ScanJobCard from '../components/ScanJobCard';
import SecurityScoreCard from '../components/SecurityScoreCard';
import { useNavigate } from 'react-router-dom';
import { getScans } from '../services/scanService';
import { getReports } from '../services/reportService';

const ACTIVE_STATUSES = new Set(['queued', 'running', 'cancelling']);

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getSeverityCounts = (scan) => {
  const counts = scan?.scan_summary?.severity_counts || {};
  return {
    critical: counts.critical || 0,
    high: counts.high || 0,
    medium: counts.medium || 0,
    low: counts.low || 0,
    info: counts.info || 0,
  };
};

const getTotalVulnerabilities = (scan) => {
  const severity = getSeverityCounts(scan);
  return severity.critical + severity.high + severity.medium + severity.low + severity.info;
};

const formatRelativeTime = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.floor(Math.max(deltaMs, 0) / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const mapScanStatusLabel = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return 'In Progress';
    case 'queued':
      return 'In Progress';
    case 'cancelling':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Paused';
    default:
      return 'In Progress';
  }
};

const buildLast7DaysVulnerabilitySeries = (scans) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  const buckets = new Map();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = toDateKey(day);
    days.push({ key, name: day.toLocaleDateString(undefined, { weekday: 'short' }) });
    buckets.set(key, 0);
  }

  scans.forEach((scan) => {
    const sourceDate = scan?.finished_at || scan?.updated_at || scan?.created_at;
    if (!sourceDate) return;

    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) return;
    parsed.setHours(0, 0, 0, 0);

    const key = toDateKey(parsed);
    if (!buckets.has(key)) return;

    const current = buckets.get(key) || 0;
    buckets.set(key, current + getTotalVulnerabilities(scan));
  });

  return days.map((day) => ({
    name: day.name,
    vulnerabilities: buckets.get(day.key) || 0,
  }));
};

const clampScore = (value) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scans, setScans] = useState([]);
  const [reportStats, setReportStats] = useState({ total: 0 });

  const fetchDashboardData = useCallback(async () => {
    try {
      setError('');
      const [scanData, reportsData] = await Promise.all([
        getScans(1, 100, {}),
        getReports(1, 10),
      ]);

      setScans(scanData.items || []);
      setReportStats({ total: reportsData.total || 0 });
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const dashboardSummary = useMemo(() => {
    const summary = {
      active: 0,
      completed: 0,
      failed: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      queued: 0,
      running: 0,
    };

    scans.forEach((scan) => {
      const status = (scan.status || '').toLowerCase();
      if (ACTIVE_STATUSES.has(status)) summary.active += 1;
      if (status === 'completed') summary.completed += 1;
      if (status === 'failed') summary.failed += 1;
      if (status === 'queued') summary.queued += 1;
      if (status === 'running') summary.running += 1;

      const counts = getSeverityCounts(scan);
      summary.critical += counts.critical;
      summary.high += counts.high;
      summary.medium += counts.medium;
      summary.low += counts.low;
    });

    return summary;
  }, [scans]);

  const vulnerabilitySeries = useMemo(() => buildLast7DaysVulnerabilitySeries(scans), [scans]);

  const securityScore = useMemo(() => {
    const weightedRisk = (
      dashboardSummary.critical * 12 +
      dashboardSummary.high * 7 +
      dashboardSummary.medium * 4 +
      dashboardSummary.low * 2
    );

    const baseline = Math.max(scans.length, 1) * 20;
    const riskRatio = weightedRisk / baseline;
    return clampScore(100 - riskRatio * 100);
  }, [dashboardSummary, scans.length]);

  const previousSecurityScore = useMemo(() => {
    const previous = securityScore - (dashboardSummary.critical > 0 ? 3 : 1);
    return clampScore(previous);
  }, [dashboardSummary.critical, securityScore]);

  const securityMetrics = useMemo(() => {
    const coverage = scans.length === 0 ? 100 : clampScore((dashboardSummary.completed / scans.length) * 100);
    const stabilityBase = dashboardSummary.completed + dashboardSummary.failed;
    const stability = stabilityBase === 0 ? 100 : clampScore((dashboardSummary.completed / stabilityBase) * 100);
    const criticalExposure = clampScore(100 - dashboardSummary.critical * 10);
    const reportReadiness = reportStats.total > 0 ? 85 : 40;

    return [
      { name: 'Scan Coverage', score: coverage },
      { name: 'Job Stability', score: stability },
      { name: 'Critical Exposure', score: criticalExposure },
      { name: 'Report Readiness', score: reportReadiness },
    ];
  }, [dashboardSummary, reportStats.total, scans.length]);

  const recentScans = useMemo(() => {
    return [...scans]
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 3)
      .map((scan) => ({
        id: scan.id,
        name: scan.scan_name || `Scan #${scan.id}`,
        target: scan.target || '-',
        status: mapScanStatusLabel(scan.status),
        startTime: scan.started_at || scan.created_at || new Date().toISOString(),
        endTime: scan.finished_at || null,
        progress: scan.progress || 0,
        vulnerabilities: getSeverityCounts(scan),
      }));
  }, [scans]);

  const recentActivity = useMemo(() => {
    return [...scans]
      .sort((a, b) => {
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 3)
      .map((scan) => {
        const status = (scan.status || '').toLowerCase();
        let title = `Scan updated for ${scan.target || scan.scan_name || 'target'}`;

        if (status === 'completed') title = `Scan completed for ${scan.target || scan.scan_name || 'target'}`;
        if (status === 'failed') title = `Scan failed for ${scan.target || scan.scan_name || 'target'}`;
        if (status === 'running') title = `Scan running for ${scan.target || scan.scan_name || 'target'}`;

        return {
          id: scan.id,
          title,
          timeText: formatRelativeTime(scan.updated_at || scan.created_at),
          issues: getTotalVulnerabilities(scan),
        };
      });
  }, [scans]);

  return (
    <div className="space-y-4 md:space-y-6 mobile-container">
      {/* Mobile-Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-responsive-xl truncate">
            Dashboard
          </h1>
          <div className="text-sm text-muted-foreground mt-1">
            Welcome back, {currentUser?.name}
          </div>
        </div>
        <Button 
          onClick={() => navigate('/new-scan')} 
          className="gap-2 mobile-btn sm:w-auto"
          size="default"
        >
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New Scan</span>
          <span className="sm:hidden">Scan</span>
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-3 text-sm text-destructive flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchDashboardData}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="py-10 text-muted-foreground flex items-center justify-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading dashboard data...
          </CardContent>
        </Card>
      ) : null}

      {/* Mobile-Responsive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard 
          title="Active Scans" 
          value={String(dashboardSummary.active)} 
          description={`${dashboardSummary.running} running, ${dashboardSummary.queued} queued`} 
          icon={<Clock className="h-4 w-4 text-muted-foreground" />} 
        />
        
        <StatCard 
          title="Critical Vulnerabilities" 
          value={String(dashboardSummary.critical)} 
          description={`${dashboardSummary.high} high-risk findings`} 
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />} 
        />
        
        <StatCard 
          title="Completed Scans" 
          value={String(dashboardSummary.completed)} 
          description={`${dashboardSummary.failed} failed`} 
          icon={<CheckCircle className="h-4 w-4 text-green-500" />} 
        />
        
        <StatCard 
          title="Security Score" 
          value={`${securityScore}%`} 
          description={`${reportStats.total} reports available`} 
          icon={<Shield className="h-4 w-4 text-primary" />} 
        />
      </div>

      {/* Mobile-Responsive Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-6">
        {/* Chart - Mobile Full Width */}
        <Card className="xl:col-span-3 mobile-card">
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-lg md:text-xl">
              Vulnerabilities Detected (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[250px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vulnerabilitySeries} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Bar 
                    dataKey="vulnerabilities" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        {/* Security Score Card - Mobile Full Width */}
        <div className="xl:col-span-1">
          <SecurityScoreCard 
            score={securityScore} 
            previousScore={previousSecurityScore}
            metrics={securityMetrics}
          />
        </div>
      </div>

      {/* Mobile-Responsive Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="lg:col-span-2 mobile-card">
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-lg md:text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent scan activity yet.</div>
              ) : recentActivity.map((item) => (
                <div key={item.id} className="flex items-center pb-3 md:pb-4 border-b last:border-0 last:pb-0">
                  <div className="mr-3 md:mr-4 flex-shrink-0">
                    <div className="rounded-full bg-primary/10 p-1.5 md:p-2">
                      <Shield className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium leading-none truncate">
                      {item.title}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {item.timeText}
                    </p>
                  </div>
                  <div className="ml-2 md:ml-auto font-medium text-xs md:text-sm flex-shrink-0">
                    {item.issues} issues
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Scans - Mobile Responsive */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 md:pb-4">
            <CardTitle className="text-lg md:text-xl">Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              {recentScans.length === 0 ? (
                <div className="text-sm text-muted-foreground">No scans available yet.</div>
              ) : recentScans.map((scan) => (
                <ScanJobCard
                  key={scan.id}
                  scan={scan}
                  onViewDetails={(scanId) => navigate(`/scans/${scanId}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile-Responsive Quick Actions */}
      <Card className="mobile-card">
        <CardHeader className="pb-3 md:pb-4">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Button 
              onClick={() => navigate('/new-scan')} 
              className="mobile-btn justify-start"
              variant="outline"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Start New Scan
            </Button>
            <Button 
              onClick={() => navigate('/reports')} 
              className="mobile-btn justify-start"
              variant="outline"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              View Reports
            </Button>
            <Button 
              onClick={() => navigate('/scans')} 
              className="mobile-btn justify-start"
              variant="outline"
            >
              <Clock className="h-4 w-4 mr-2" />
              Monitor Scans
            </Button>
            <Button 
              onClick={() => navigate('/settings')} 
              className="mobile-btn justify-start"
              variant="outline"
            >
              <Shield className="h-4 w-4 mr-2" />
              Security Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;