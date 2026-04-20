import { useEffect, useState } from 'react';
import { FileText, Search, ArrowUpDown, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ScanDetailsModal from '../components/ScanDetailsModal';
import { useNavigate } from 'react-router-dom';
import { getScans, retryScan } from '../services/scanService';

const FINISHED_STATES = ['completed', 'failed', 'cancelled'];

const normalizeScan = (scan) => {
  const severity = scan?.scan_summary?.severity_counts || {};
  return {
    id: scan.id,
    name: scan.scan_name,
    target: scan.target,
    completedDate: scan.finished_at || scan.updated_at || scan.created_at,
    duration: scan.finished_at && scan.started_at ? 'Completed' : 'N/A',
    vulnerabilities: {
      critical: severity.critical || 0,
      high: severity.high || 0,
      medium: severity.medium || 0,
      low: severity.low || 0,
    },
    status: scan.status,
    summary: scan.error_message || 'Scan finished',
    scanType: scan.scan_profile || 'standard',
    scanProfile: scan.planner_engine || 'rules',
    initiatedBy: 'Authenticated User',
    reportId: scan?.scan_summary?.report_id || null,
    startTime: scan.started_at || scan.created_at,
    endTime: scan.finished_at,
  };
};

const CompletedScans = () => {
  const [completedScans, setCompletedScans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedScan, setSelectedScan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchCompletedScans = async () => {
    try {
      setError('');
      const data = await getScans(1, 100, {});
      const items = (data.items || [])
        .filter((scan) => FINISHED_STATES.includes(scan.status))
        .map(normalizeScan);
      setCompletedScans(items);
    } catch (err) {
      setError(err.message || 'Failed to load completed scans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompletedScans();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const filteredScans = completedScans.filter((scan) =>
    `${scan.target} ${scan.name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSeverityLevel = (scan) => {
    if (scan.status === 'failed') return 'Failed';
    if (scan.status === 'cancelled') return 'Cancelled';
    if (scan.vulnerabilities.critical > 0) return 'Critical';
    if (scan.vulnerabilities.high > 0) return 'High';
    if (scan.vulnerabilities.medium > 0) return 'Medium';
    return 'Low';
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return 'text-destructive';
      case 'High': return 'text-red-600';
      case 'Medium': return 'text-amber-600';
      case 'Low': return 'text-blue-600';
      case 'Failed': return 'text-destructive';
      case 'Cancelled': return 'text-muted-foreground';
      default: return 'text-green-600';
    }
  };

  const getTotalVulnerabilities = (scan) => {
    const { critical, high, medium, low } = scan.vulnerabilities;
    return critical + high + medium + low;
  };

  // Function to handle view report
  const handleViewReport = (scanId) => {
    const scan = completedScans.find((item) => item.id === scanId);
    setIsModalOpen(false);
    if (scan?.reportId) {
      navigate(`/reports/${scan.reportId}`);
      return;
    }
    navigate('/reports');
  };
  
  // Function to open scan details modal
  const openScanDetails = (scan) => {
    setSelectedScan(scan);
    setIsModalOpen(true);
  };

  const handleRetry = async (scanId) => {
    try {
      await retryScan(scanId);
      navigate('/scans');
    } catch (err) {
      setError(err.message || 'Failed to retry scan');
    }
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Completed Scans</h1>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search scans..."
                className="pl-8 h-9 w-[200px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchCompletedScans}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Scan History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading scan history...
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">
                    <div className="flex items-center">
                      Target
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center">
                      Completed
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Vulnerabilities</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScans.map((scan) => {
                  const severity = getSeverityLevel(scan);
                  const severityColor = getSeverityColor(severity);
                  
                  return (
                    <TableRow key={scan.id}>
                      <TableCell className="font-medium">{scan.target}</TableCell>
                      <TableCell>{formatDate(scan.completedDate)}</TableCell>
                      <TableCell>{scan.duration}</TableCell>
                      <TableCell>
                        <div className={`font-medium ${severityColor}`}>
                          {severity}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {scan.vulnerabilities.critical > 0 && (
                            <span className="px-2 py-1 text-xs rounded-full bg-destructive/10 text-destructive">
                              {scan.vulnerabilities.critical} Critical
                            </span>
                          )}
                          <span className="text-sm">
                            {getTotalVulnerabilities(scan)} total
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openScanDetails(scan)}>
                          <FileText className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/scans/${scan.id}`)}>
                          Open
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleRetry(scan.id)}>
                          Retry
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      
      {/* Scan Details Modal */}
      {selectedScan && (
        <ScanDetailsModal 
          scan={selectedScan} 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onViewReport={handleViewReport}
        />
      )}
    </>
  );
};

export default CompletedScans;