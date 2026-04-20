import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  RotateCcw,
  StopCircle,
} from 'lucide-react';

import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  cancelScan,
  downloadScanArtifact,
  getScanArtifacts,
  getScanById,
  getScanFindings,
  getScanLogs,
  retryScan,
} from '../services/scanService';

const statusColor = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'running':
      return 'bg-green-100 text-green-800';
    case 'queued':
      return 'bg-blue-100 text-blue-800';
    case 'cancelling':
      return 'bg-amber-100 text-amber-800';
    case 'cancelled':
      return 'bg-amber-100 text-amber-800';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const severityBadgeClass = (severity) => {
  switch ((severity || '').toLowerCase()) {
    case 'critical':
      return 'bg-red-600 text-white';
    case 'high':
      return 'bg-orange-500 text-white';
    case 'medium':
      return 'bg-yellow-500 text-white';
    case 'low':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-slate-500 text-white';
  }
};

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
};

const extractErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const ScanDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [scan, setScan] = useState(null);
  const [logs, setLogs] = useState([]);
  const [findings, setFindings] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const scanData = await getScanById(id);
      setScan(scanData);

      const [logsResult, findingsResult, artifactsResult] = await Promise.allSettled([
        getScanLogs(id, 1, 200),
        getScanFindings(id, 1, 200),
        getScanArtifacts(id),
      ]);

      const partialErrors = [];

      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value.items || []);
      } else {
        setLogs([]);
        partialErrors.push(extractErrorMessage(logsResult.reason, 'Failed to load scan logs'));
      }

      if (findingsResult.status === 'fulfilled') {
        setFindings(findingsResult.value.items || []);
      } else {
        setFindings([]);
        partialErrors.push(extractErrorMessage(findingsResult.reason, 'Failed to load scan findings'));
      }

      if (artifactsResult.status === 'fulfilled') {
        setArtifacts(artifactsResult.value || []);
      } else {
        setArtifacts([]);
        partialErrors.push(extractErrorMessage(artifactsResult.reason, 'Failed to load scan artifacts'));
      }

      if (partialErrors.length > 0) {
        setError(partialErrors.join(' | '));
      }
    } catch (err) {
      setScan(null);
      setLogs([]);
      setFindings([]);
      setArtifacts([]);
      setError(extractErrorMessage(err, 'Failed to load scan details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const severityCounts = useMemo(() => {
    const fromSummary = scan?.scan_summary?.severity_counts;
    if (fromSummary) {
      return {
        critical: fromSummary.critical || 0,
        high: fromSummary.high || 0,
        medium: fromSummary.medium || 0,
        low: fromSummary.low || 0,
        info: fromSummary.info || 0,
      };
    }

    return findings.reduce(
      (acc, finding) => {
        const key = (finding.severity || 'info').toLowerCase();
        if (acc[key] !== undefined) {
          acc[key] += 1;
        }
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    );
  }, [scan, findings]);

  const filteredFindings = useMemo(() => {
    if (severityFilter === 'all') {
      return findings;
    }
    return findings.filter((item) => (item.severity || '').toLowerCase() === severityFilter);
  }, [findings, severityFilter]);

  const canCancel = ['queued', 'running'].includes((scan?.status || '').toLowerCase());
  const canRetry = ['completed', 'failed', 'cancelled'].includes((scan?.status || '').toLowerCase());

  const handleCancel = async () => {
    if (!scan) return;

    try {
      setActionLoading(true);
      await cancelScan(scan.id);
      await fetchDetails();
    } catch (err) {
      setError(err.message || 'Failed to request cancellation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!scan) return;

    try {
      setActionLoading(true);
      const newJob = await retryScan(scan.id);
      navigate(`/scans/${newJob.id}`);
    } catch (err) {
      setError(err.message || 'Failed to retry scan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (artifact) => {
    if (!scan) return;

    try {
      setActionLoading(true);
      await downloadScanArtifact(scan.id, String(artifact.id), artifact.file_name);
    } catch (err) {
      setError(err.message || 'Failed to download artifact');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading scan details...
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="outline" onClick={() => navigate('/scans')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">Scan job not found.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Scan Job #{scan.id}</h1>
          <p className="text-muted-foreground">{scan.scan_name} · {scan.target}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchDetails} disabled={loading || actionLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Badge className={statusColor(scan.status)}>{scan.status}</Badge>
          <Button variant="outline" onClick={handleCancel} disabled={!canCancel || actionLoading}>
            <StopCircle className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleRetry} disabled={!canRetry || actionLoading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={scan.progress || 0} />
              <div className="text-sm font-medium">{scan.progress || 0}%</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Critical</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-red-600">{severityCounts.critical}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">High</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-orange-600">{severityCounts.high}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Medium</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-yellow-600">{severityCounts.medium}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Low</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-blue-600">{severityCounts.low}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Execution Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="font-medium">Target:</span> {scan.target}</div>
              <div><span className="font-medium">Type:</span> {scan.target_type || 'unknown'}</div>
              <div><span className="font-medium">Profile:</span> {scan.scan_profile}</div>
              <div><span className="font-medium">Planner:</span> {scan.planner_engine}</div>
              <div><span className="font-medium">Orchestration:</span> {scan.orchestration_mode}</div>
              <div><span className="font-medium">Created:</span> {formatDateTime(scan.created_at)}</div>
              <div><span className="font-medium">Started:</span> {formatDateTime(scan.started_at)}</div>
              <div><span className="font-medium">Finished:</span> {formatDateTime(scan.finished_at)}</div>
              <div><span className="font-medium">Summary:</span> {scan.error_message || 'No error message'}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No logs available yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.step}</TableCell>
                        <TableCell className="font-medium">{item.tool}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>{item.attempts}</TableCell>
                        <TableCell>{item.return_code ?? '-'}</TableCell>
                        <TableCell className="max-w-xs truncate">{item.output_summary || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Findings</CardTitle>
              <div className="flex flex-wrap gap-2">
                {['all', 'critical', 'high', 'medium', 'low', 'info'].map((level) => (
                  <Button
                    key={level}
                    variant={severityFilter === level ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSeverityFilter(level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {filteredFindings.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No findings for this filter.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFindings.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-xs truncate">{item.asset}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>
                          <Badge className={severityBadgeClass(item.severity)}>{item.severity}</Badge>
                        </TableCell>
                        <TableCell>{item.source_tool}</TableCell>
                        <TableCell>{item.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="artifacts">
          <Card>
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              {artifacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No artifacts available yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {artifacts.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.file_name}</TableCell>
                        <TableCell>{item.artifact_type}</TableCell>
                        <TableCell>{item.size_bytes} bytes</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleDownload(item)} disabled={actionLoading}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {scan.status === 'failed' && scan.error_message ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Failure Details
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">{scan.error_message}</CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default ScanDetails;
