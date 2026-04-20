import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  StopCircle,
  Timer,
} from 'lucide-react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cancelScan, getScans, retryScan } from '../services/scanService';

const ACTIVE_STATES = ['queued', 'running', 'cancelling'];

const STATUS_GROUPS = {
  all: [],
  active: ACTIVE_STATES,
  completed: ['completed'],
  failed: ['failed'],
  cancelled: ['cancelled'],
};

const statusBadgeClass = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return 'bg-green-100 text-green-800';
    case 'queued':
      return 'bg-blue-100 text-blue-800';
    case 'cancelling':
      return 'bg-amber-100 text-amber-800';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'cancelled':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const severitySummary = (scan) => {
  const counts = scan?.scan_summary?.severity_counts || {};
  return {
    critical: counts.critical || 0,
    high: counts.high || 0,
    medium: counts.medium || 0,
    low: counts.low || 0,
  };
};

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
};

const durationText = (scan) => {
  if (!scan.started_at) {
    return '-';
  }

  const start = new Date(scan.started_at);
  const end = scan.finished_at ? new Date(scan.finished_at) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '-';
  }

  const diffMs = Math.max(end.getTime() - start.getTime(), 0);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

const hasSeverity = (scan, severity) => {
  if (severity === 'all') {
    return true;
  }

  const counts = severitySummary(scan);
  return (counts[severity] || 0) > 0;
};

const canCancel = (status) => ['queued', 'running'].includes((status || '').toLowerCase());
const canRetry = (status) => ['completed', 'failed', 'cancelled'].includes((status || '').toLowerCase());

const Scans = () => {
  const navigate = useNavigate();

  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionBusyId, setActionBusyId] = useState(null);

  const fetchScans = useCallback(async (showLoadingState = false) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError('');
      const data = await getScans(1, 100, {});
      setScans(data.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load scans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchScans(true);
  }, [fetchScans]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchScans(false);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchScans]);

  const summary = useMemo(() => {
    return scans.reduce(
      (acc, scan) => {
        const status = (scan.status || '').toLowerCase();
        if (ACTIVE_STATES.includes(status)) {
          acc.active += 1;
        }
        if (status === 'completed') {
          acc.completed += 1;
        }
        if (status === 'failed') {
          acc.failed += 1;
        }
        if (status === 'cancelled') {
          acc.cancelled += 1;
        }
        return acc;
      },
      { active: 0, completed: 0, failed: 0, cancelled: 0 }
    );
  }, [scans]);

  const filteredScans = useMemo(() => {
    const allowedStatuses = STATUS_GROUPS[statusFilter] || [];
    const loweredSearch = searchQuery.trim().toLowerCase();

    return scans
      .filter((scan) => {
        const status = (scan.status || '').toLowerCase();
        if (allowedStatuses.length > 0 && !allowedStatuses.includes(status)) {
          return false;
        }

        if (!hasSeverity(scan, severityFilter)) {
          return false;
        }

        if (!loweredSearch) {
          return true;
        }

        const haystack = `${scan.scan_name || ''} ${scan.target || ''} ${scan.status || ''}`.toLowerCase();
        return haystack.includes(loweredSearch);
      })
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }, [scans, searchQuery, severityFilter, statusFilter]);

  const handleCancel = async (scanId) => {
    try {
      setActionBusyId(`cancel-${scanId}`);
      await cancelScan(scanId);
      await fetchScans(false);
    } catch (err) {
      setError(err.message || 'Failed to cancel scan');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRetry = async (scanId) => {
    try {
      setActionBusyId(`retry-${scanId}`);
      const newJob = await retryScan(scanId);
      navigate(`/scans/${newJob.id}`);
    } catch (err) {
      setError(err.message || 'Failed to retry scan');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Monitor active jobs and review historical scan runs.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchScans(false)} disabled={loading || refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => navigate('/new-scan')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Scan
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-700">{summary.active}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-emerald-700">{summary.completed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-700">{summary.failed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Cancelled</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-slate-700">{summary.cancelled}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Jobs</CardTitle>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name or target"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option value="all">Any Severity</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading scans...
            </div>
          ) : null}

          {!loading && filteredScans.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
              No scans match your filters.
            </div>
          ) : null}

          {!loading && filteredScans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Scan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScans.map((scan) => {
                  const severity = severitySummary(scan);
                  const total = severity.critical + severity.high + severity.medium + severity.low;
                  const status = (scan.status || 'queued').toLowerCase();
                  return (
                    <TableRow key={scan.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{scan.scan_name || `Scan #${scan.id}`}</div>
                          <div className="text-xs text-muted-foreground">{scan.target || '-'}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusBadgeClass(status)}>{status}</Badge>
                      </TableCell>

                      <TableCell>
                        <div className="w-40 space-y-1">
                          <Progress value={scan.progress || 0} />
                          <div className="text-xs text-muted-foreground">{scan.progress || 0}%</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1 text-xs">
                          {severity.critical > 0 ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">{severity.critical}C</span>
                          ) : null}
                          {severity.high > 0 ? (
                            <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-700">{severity.high}H</span>
                          ) : null}
                          {severity.medium > 0 ? (
                            <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-700">{severity.medium}M</span>
                          ) : null}
                          {severity.low > 0 ? (
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{severity.low}L</span>
                          ) : null}
                          {total === 0 ? <span className="text-muted-foreground">No findings</span> : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Timer className="mr-1 h-3.5 w-3.5" />
                          {durationText(scan)}
                        </div>
                      </TableCell>

                      <TableCell>{formatDateTime(scan.started_at || scan.created_at)}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/scans/${scan.id}`)}>
                            Open
                          </Button>

                          {canCancel(status) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(scan.id)}
                              disabled={actionBusyId === `cancel-${scan.id}` || status === 'cancelling'}
                            >
                              <StopCircle className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          ) : null}

                          {canRetry(status) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(scan.id)}
                              disabled={actionBusyId === `retry-${scan.id}`}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />
                              Retry
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {summary.failed > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Failed Scans Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">
            {summary.failed} scan job{summary.failed === 1 ? '' : 's'} failed. Review details and retry if the target is still authorized.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              No Failed Jobs Right Now
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-emerald-700">
            Active and completed scans can be monitored from this page.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Scans;
