import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertTriangle, Clock, CheckCircle, PauseCircle, FileText, Loader2, Download } from 'lucide-react';
import { downloadScanArtifact, getScanArtifacts, getScanFindings, getScanLogs } from '../services/scanService';

const ScanDetailsModal = ({ scan, isOpen, onClose, onViewReport }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [findings, setFindings] = useState([]);
  const [artifacts, setArtifacts] = useState([]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!isOpen || !scan?.id) return;

      try {
        setLoading(true);
        setError('');
        const [logsData, findingsData, artifactsData] = await Promise.all([
          getScanLogs(scan.id, 1, 50),
          getScanFindings(scan.id, 1, 100),
          getScanArtifacts(scan.id),
        ]);

        setLogs(logsData.items || []);
        setFindings(findingsData.items || []);
        setArtifacts(artifactsData || []);
      } catch (err) {
        setError(err.message || 'Failed to load scan details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, scan?.id]);

  if (!scan) return null;

  // Function to determine status icon
  const getStatusIcon = (status) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'in progress':
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-indigo-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'cancelling':
      case 'cancelled':
        return <PauseCircle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  // Function to determine progress color
  const getProgressColor = (status) => {
    const normalized = (status || '').toLowerCase();
    switch (normalized) {
      case 'in progress':
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'cancelling':
      case 'cancelled':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Function to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
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
  const getSeverityColor = (severity) => {
    switch ((severity || '').toLowerCase()) {
      case 'critical':
        return 'bg-red-500 hover:bg-red-600';
      case 'high':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'medium':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'low':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'info':
        return 'bg-gray-500 hover:bg-gray-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const liveVulnerabilityList = findings.length
    ? findings.map((finding) => ({
        title: finding.category || 'Security finding',
        severity: finding.severity || 'info',
        cvssScore: '-',
        status: finding.status || 'Open',
      }))
    : scan.vulnerabilityList || [];

  const handleDownloadArtifact = async (artifact) => {
    try {
      await downloadScanArtifact(scan.id, String(artifact.id), artifact.file_name);
    } catch (downloadError) {
      setError(downloadError.message || 'Failed to download artifact');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon(scan.status)}
            <span>{scan.name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Scan Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Target</p>
              <p className="font-medium">{scan.target}</p>
            </div>
            <div>
              <p className="text-gray-500">Status</p>
              <p className="font-medium flex items-center gap-1">
                {getStatusIcon(scan.status)}
                {scan.status}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Start Time</p>
              <p className="font-medium">{formatDate(scan.startTime)}</p>
            </div>
            <div>
              <p className="text-gray-500">End Time</p>
              <p className="font-medium">{formatDate(scan.endTime)}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          {scan.progress < 100 && scan.status.toLowerCase() !== 'completed' && (
            <div>
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
          
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {/* Tabs */}
          <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {scan.vulnerabilities && (
                  <>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-xs text-gray-500">Critical</p>
                      <p className="text-xl font-bold text-red-600">{scan.vulnerabilities.critical || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                      <p className="text-xs text-gray-500">High</p>
                      <p className="text-xl font-bold text-orange-600">{scan.vulnerabilities.high || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                      <p className="text-xs text-gray-500">Medium</p>
                      <p className="text-xl font-bold text-yellow-600">{scan.vulnerabilities.medium || 0}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                      <p className="text-xs text-gray-500">Low</p>
                      <p className="text-xl font-bold text-blue-600">{scan.vulnerabilities.low || 0}</p>
                    </div>
                  </>
                )}
              </div>
              
              {scan.summary && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Scan Summary</h4>
                  <p className="text-sm text-gray-700">{scan.summary}</p>
                </div>
              )}
            </TabsContent>
            
            {/* Vulnerabilities Tab */}
            <TabsContent value="vulnerabilities">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading vulnerabilities...
                </div>
              ) : liveVulnerabilityList && liveVulnerabilityList.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>CVSS</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liveVulnerabilityList.map((vuln, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{vuln.title}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(vuln.severity)}>
                            {vuln.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{vuln.cvssScore}</TableCell>
                        <TableCell>{vuln.status || 'Open'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {scan.status.toLowerCase() === 'completed' 
                    ? 'No vulnerabilities found' 
                    : 'Vulnerabilities will appear here once the scan is complete'}
                </div>
              )}
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading logs...
                </div>
              ) : logs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Step</TableHead>
                      <TableHead>Tool</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Summary</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.step}</TableCell>
                        <TableCell className="font-medium">{log.tool}</TableCell>
                        <TableCell>{log.status}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.output_summary || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">No execution logs available yet.</div>
              )}
            </TabsContent>

            {/* Artifacts Tab */}
            <TabsContent value="artifacts">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading artifacts...
                </div>
              ) : artifacts.length > 0 ? (
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
                    {artifacts.map((artifact) => (
                      <TableRow key={artifact.id}>
                        <TableCell className="font-medium">{artifact.file_name}</TableCell>
                        <TableCell>{artifact.artifact_type}</TableCell>
                        <TableCell>{artifact.size_bytes} bytes</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadArtifact(artifact)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">No artifacts available yet.</div>
              )}
            </TabsContent>
            
            {/* Details Tab */}
            <TabsContent value="details">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Scan Configuration</h4>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Scan Type</TableCell>
                        <TableCell>{scan.scanType || 'Full Scan'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Scan Profile</TableCell>
                        <TableCell>{scan.scanProfile || 'Default'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Initiated By</TableCell>
                        <TableCell>{scan.initiatedBy || 'System'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Scan Duration</TableCell>
                        <TableCell>{scan.duration || 'N/A'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {scan.status.toLowerCase() === 'completed' && (
            <Button onClick={() => onViewReport(scan.id)}>
              <FileText className="h-4 w-4 mr-2" />
              View Full Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScanDetailsModal;