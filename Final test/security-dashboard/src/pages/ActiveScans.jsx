import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Loader2, MoreHorizontal, RefreshCw, StopCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import ScanDetailsModal from '../components/ScanDetailsModal';
import { useNavigate } from 'react-router-dom';
import { cancelScan, getScans } from '../services/scanService';

const ACTIVE_STATES = ['queued', 'running', 'cancelling'];

const severitySummary = (scan) => {
  const counts = scan?.scan_summary?.severity_counts || {};
  return {
    critical: counts.critical || 0,
    high: counts.high || 0,
    medium: counts.medium || 0,
    low: counts.low || 0,
  };
};

const normalizeScan = (scan) => {
  const status = scan.status || 'queued';
  let displayStatus = 'Queued';
  if (status === 'running') {
    displayStatus = 'In Progress';
  } else if (status === 'cancelling') {
    displayStatus = 'Cancelling';
  }

  return {
    id: scan.id,
    name: scan.scan_name,
    target: scan.target,
    progress: scan.progress || 0,
    status: displayStatus,
    startTime: scan.started_at || scan.created_at,
    endTime: scan.finished_at,
    vulnerabilities: severitySummary(scan),
    summary: scan.error_message || 'Scan is running in the background.',
    scanType: scan.scan_profile || 'standard',
    scanProfile: scan.planner_engine || 'rules',
    initiatedBy: 'Authenticated User',
    duration: scan.finished_at ? 'Completed' : 'In progress',
    reportId: scan?.scan_summary?.report_id || null,
    rawStatus: status,
  };
};

const ActiveScans = () => {
  const [activeScans, setActiveScans] = useState([]);
  const [selectedScan, setSelectedScan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);
  const navigate = useNavigate();

  const fetchActiveScans = async () => {
    try {
      setError('');
      const data = await getScans(1, 100, {});
      const items = (data.items || [])
        .filter((scan) => ACTIVE_STATES.includes(scan.status))
        .map(normalizeScan);
      setActiveScans(items);
    } catch (err) {
      setError(err.message || 'Failed to load active scans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveScans();
  }, [refreshTick]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTick((value) => value + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const requestCancelScan = async (scanId) => {
    try {
      await cancelScan(scanId);
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setError(err.message || 'Failed to cancel scan');
    }
  };

  const openScanDetails = (scan) => {
    setSelectedScan(scan);
    setIsModalOpen(true);
  };

  const handleViewReport = (scanId) => {
    const scan = activeScans.find((item) => item.id === scanId);
    setIsModalOpen(false);
    if (scan?.reportId) {
      navigate(`/reports/${scan.reportId}`);
      return;
    }
    navigate('/completed-scans');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateElapsedTime = (dateString) => {
    const startTime = new Date(dateString);
    const now = new Date();
    const diffMs = now - startTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);

    if (diffHrs > 0) {
      return `${diffHrs}h ${diffMins % 60}m`;
    }
    return `${Math.max(diffMins, 0)}m`;
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Active Scans</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setRefreshTick((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => navigate('/new-scan')}>New Scan</Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading active scans...
          </div>
        ) : null}

        {!loading && activeScans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No active scan jobs.
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          {activeScans.map((scan) => (
            <Card key={scan.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg font-medium">{scan.name}</CardTitle>
                  <div className="mt-1 flex items-center text-sm text-muted-foreground">
                    <Clock className="mr-1 h-3 w-3" />
                    Started at {formatDate(scan.startTime)} ({calculateElapsedTime(scan.startTime)} elapsed)
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.preventDefault();
                        openScanDetails(scan);
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openScanDetails(scan)}>View Details</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/scans/${scan.id}`)}>Open Scan Page</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => requestCancelScan(scan.id)}
                      disabled={scan.rawStatus === 'cancelling'}
                    >
                      Request Cancel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{scan.progress}%</span>
                    </div>
                    <Progress value={scan.progress} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => requestCancelScan(scan.id)}
                        disabled={scan.rawStatus === 'cancelling'}
                      >
                        <StopCircle className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          scan.rawStatus === 'running'
                            ? 'bg-green-100 text-green-800'
                            : scan.rawStatus === 'cancelling'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {scan.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {scan.vulnerabilities.critical > 0 && (
                        <div className="flex items-center text-xs">
                          <AlertTriangle className="mr-1 h-3 w-3 text-destructive" />
                          <span className="font-medium">{scan.vulnerabilities.critical}</span>
                        </div>
                      )}
                      {scan.vulnerabilities.high > 0 && (
                        <div className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
                          {scan.vulnerabilities.high} High
                        </div>
                      )}
                      {scan.vulnerabilities.medium > 0 && (
                        <div className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                          {scan.vulnerabilities.medium} Med
                        </div>
                      )}
                      {scan.vulnerabilities.low > 0 && (
                        <div className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          {scan.vulnerabilities.low} Low
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedScan ? (
        <ScanDetailsModal
          scan={selectedScan}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onViewReport={handleViewReport}
        />
      ) : null}
    </>
  );
};

export default ActiveScans;