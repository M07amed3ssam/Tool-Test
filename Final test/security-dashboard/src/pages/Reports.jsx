import { useState, useEffect, useCallback } from 'react';
import { 
  FileBarChart, 
  Eye, 
  Calendar, 
  Globe, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SecureFileDownload from '../components/SecureFileDownload';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { getReports, getFinalReport } from '../services/reportService';

// Fallback mock data for vulnerability report


const Reports = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch reports from API
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getReports(page, pageSize);
      setReports(data.items);
      setTotalPages(data.total_pages);
      
      // If we have reports and no current report is selected, select the first one
      if (data.items.length > 0 && !currentReport) {
        setCurrentReport(data.items[0]);
        fetchReportData(data.items[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, currentReport]);

  // Fetch reports on component mount
  useEffect(() => {
    fetchReports();
  }, [page, fetchReports]);

  // Fetch report data for a specific report
  const fetchReportData = async (reportId) => {
    try {
      setLoading(true);
      const data = await getFinalReport(reportId);
      setReportData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle report selection
  const handleReportSelect = (report) => {
    setCurrentReport(report);
    fetchReportData(report.id);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchReports();
    if (currentReport) {
      fetchReportData(currentReport.id);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (report) => {
    // Mock status based on report data
    const hasVulns = reportData?.summary?.counts?.vulnerabilities_total > 0;
    if (hasVulns) {
      return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
    }
    return <Badge variant="success" className="text-xs">Secure</Badge>;
  };

  // Filter reports based on search term
  const filteredReports = reports.filter(report => 
    report.report_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );


  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Error Alert */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4 animate-scale-in" role="alert">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-semibold">Error Loading Reports</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Vulnerability Reports
          </h1>
          <p className="text-muted-foreground">
            Comprehensive security analysis and findings
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {currentReport && (
            <>
              <Button 
                variant="default" 
                size="sm"
                onClick={() => navigate(`/reports/${currentReport.id}`)}
                className="gap-2 hover-glow"
              >
                <Eye className="h-4 w-4" />
                View Details
              </Button>
              <SecureFileDownload 
                report={currentReport} 
                buttonText="Download" 
                variant="outline"
                size="sm"
                className="gap-2"
              />
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      {loading && !reportData ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <Shield className="w-6 h-6 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Loading Security Reports</p>
            <p className="text-sm text-muted-foreground">Analyzing vulnerability data...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Reports Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileBarChart className="h-5 w-5" />
                  Reports Library
                </CardTitle>
                
                {/* Search and Filter */}
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reports..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                {filteredReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileBarChart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No reports found</p>
                    <p className="text-sm text-muted-foreground">Try adjusting your search</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto scrollable">
                    {filteredReports.map((report) => (
                      <div 
                        key={report.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 border ${
                          currentReport?.id === report.id 
                            ? 'bg-primary/10 border-primary/30 shadow-md' 
                            : 'hover:bg-accent/50 hover:shadow-sm border-transparent'
                        }`}
                        onClick={() => handleReportSelect(report)}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm line-clamp-2">{report.report_name}</h4>
                            {currentReport?.id === report.id && getStatusBadge(report)}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" />
                            <span className="truncate">{report.domain}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(report.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(page > 1 ? page - 1 : 1)}
                    disabled={page <= 1}
                    className="text-xs"
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground font-medium">
                    {page} of {totalPages}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                    disabled={page >= totalPages}
                    className="text-xs"
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Report Details */}
          <div className="lg:col-span-3">
            {!currentReport ? (
              <Card className="h-96">
                <CardContent className="flex flex-col items-center justify-center h-full text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                    <FileBarChart className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-2">Select a Report</h3>
                    <p className="text-muted-foreground">Choose a vulnerability report from the list to view detailed analysis</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{currentReport.report_name}</CardTitle>
                      {getStatusBadge(currentReport)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Globe className="h-4 w-4" />
                        <span>{currentReport.domain}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(currentReport.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6">
                  <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-1 mb-6">
                      <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        Summary Overview
                      </TabsTrigger>
                    </TabsList>
            
                    <TabsContent value="summary" className="space-y-6 mt-6">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                          <div className="relative">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            <Shield className="w-5 h-5 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                          </div>
                          <p className="text-muted-foreground">Loading report data...</p>
                        </div>
                      ) : reportData ? (
                        <div className="space-y-6">
                          {/* Quick Stats Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Subdomains</p>
                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                      {reportData.summary.counts?.total_subdomains || 0}
                                    </p>
                                  </div>
                                  <Globe className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Live Hosts</p>
                                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                      {reportData.summary.counts?.live_hosts || 0}
                                    </p>
                                  </div>
                                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Open Ports</p>
                                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                                      {reportData.summary.counts?.open_ports || 0}
                                    </p>
                                  </div>
                                  <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">Vulnerabilities</p>
                                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                                      {reportData.summary.counts?.vulnerabilities_total || 0}
                                    </p>
                                  </div>
                                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Detailed Information */}
                          <div className="grid gap-6 md:grid-cols-2">
                            {/* Scan Information */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Clock className="h-5 w-5" />
                                  Scan Information
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm font-medium text-muted-foreground">Target Domain</span>
                                    <span className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">
                                      {reportData.metadata?.domain || currentReport.domain}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm font-medium text-muted-foreground">Scan Date</span>
                                    <span className="text-sm">
                                      {formatDate(reportData.metadata?.generation_time || currentReport.created_at)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm font-medium text-muted-foreground">Report Name</span>
                                    <span className="text-sm truncate max-w-48">{currentReport.report_name}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-2">
                                    <span className="text-sm font-medium text-muted-foreground">Total URLs</span>
                                    <span className="text-sm font-bold">
                                      {reportData.summary.counts?.unique_urls || 0}
                                    </span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                            
                            {/* Security Overview */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Shield className="h-5 w-5" />
                                  Security Overview
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-4">
                                  {/* Security Score */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm font-medium">Security Score</span>
                                      <span className="text-sm font-bold">
                                        {reportData.summary.counts?.vulnerabilities_total > 0 ? '65%' : '95%'}
                                      </span>
                                    </div>
                                    <Progress 
                                      value={reportData.summary.counts?.vulnerabilities_total > 0 ? 65 : 95} 
                                      className="h-2"
                                    />
                                  </div>

                                  {/* Risk Level */}
                                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-sm font-medium text-muted-foreground">Risk Level</span>
                                    {reportData.summary.counts?.vulnerabilities_total > 0 ? (
                                      <Badge variant="destructive">High Risk</Badge>
                                    ) : (
                                      <Badge variant="success">Low Risk</Badge>
                                    )}
                                  </div>

                                  {/* Vulnerability Breakdown */}
                                  <div className="space-y-2">
                                    <span className="text-sm font-medium text-muted-foreground">Vulnerability Types</span>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-critical">Critical:</span>
                                        <span className="font-semibold">0</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-high">High:</span>
                                        <span className="font-semibold">
                                          {Math.max(0, (reportData.summary.counts?.vulnerabilities_total || 0) - 2)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-medium">Medium:</span>
                                        <span className="font-semibold">1</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-low">Low:</span>
                                        <span className="font-semibold">1</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div className="text-center">
                            <h3 className="font-medium mb-1">No Data Available</h3>
                            <p className="text-sm text-muted-foreground">Report data could not be loaded</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;