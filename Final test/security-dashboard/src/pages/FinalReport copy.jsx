import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  ArrowLeft, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Globe,
  Calendar,
  Download,
  Eye,
  Filter,
  Search,
  ExternalLink,
  Clock,
  Target,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getFinalReport } from '../services/reportService';
import { useTheme } from '../context/ThemeContext';

const FinalReport = () => {
  const reportRef = useRef(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useTheme(); // Using the theme context to ensure the component updates with theme changes

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const data = await getFinalReport(id);
        setReport(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [id]);

  const handleBackClick = () => {
    navigate('/reports');
  };

  const handleFilterClick = (severity) => {
    setActiveFilter(severity);
    // Smooth scroll to the findings section
    reportRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-foreground">Loading report data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="bg-destructive/20 border border-destructive text-foreground px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Error Loading Report</h2>
          <p>{error}</p>
          <Button 
            className="mt-4" 
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <div className="bg-card border border-border text-foreground px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
          <p>The requested report could not be found or you don't have permission to view it.</p>
          <Button 
            className="mt-4" 
            onClick={handleBackClick}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
          </Button>
        </div>
      </div>
    );
  }

  // Extract data from the report with proper default values
  const {
    metadata = {},
    summary = { counts: {} },
    critical_severity_vulnerabilities = [],
    high_severity_vulnerabilities = [],
    medium_severity_vulnerabilities = [],
    low_severity_vulnerabilities = [],
    subdomains = [],
    ports = [],
    recommendations = {
      immediate: [],
      short_term: [],
      medium_term: []
    }
  } = report?.assets ? report.assets : report || {}; // Extract from report.assets if available, otherwise from report
  
  // Map the counts from the JSON structure to the expected structure in the UI
  const mappedCounts = {
    subdomains: summary.counts.total_subdomains || 0,
    hosts: summary.counts.live_hosts || 0,
    ports: summary.counts.open_ports || 0,
    urls: summary.counts.unique_urls || 0,
    vulnerabilities: summary.counts.vulnerabilities_total || 0
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 gradient-mesh opacity-20 pointer-events-none" />
      
      {/* Back button */}
      <div className="relative z-10 p-6">
        <Button 
          variant="outline" 
          onClick={handleBackClick}
          className="mb-6 hover-lift focus-ring bg-card/80 backdrop-blur-sm border-border/60"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </div>

      {/* Enhanced Header */}
      <div className="relative z-10 mb-8">
        <Card className="mx-6 glass-strong shadow-xl border-border/30 animate-fade-in-down">
          <CardHeader className="p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <CardTitle className="text-3xl font-bold tracking-tight leading-tight">
                    Security Recon Report
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-primary" />
                    <span className="text-2xl font-extrabold text-primary">{metadata?.domain || 'Domain'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Scan generated: {new Date(metadata?.scan_start || new Date()).toLocaleDateString()}</span>
                </div>

                {/* Enhanced Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-6">
                  <div className="dashboard-card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700/50">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Subdomains</div>
                        <div className="text-lg font-bold text-blue-800 dark:text-blue-200">{mappedCounts.subdomains}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700/50">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium">Live Hosts</div>
                        <div className="text-lg font-bold text-green-800 dark:text-green-200">{mappedCounts.hosts}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700/50">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">Ports</div>
                        <div className="text-lg font-bold text-purple-800 dark:text-purple-200">{mappedCounts.ports}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700/50">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <div>
                        <div className="text-xs text-orange-600 dark:text-orange-400 font-medium">URLs</div>
                        <div className="text-lg font-bold text-orange-800 dark:text-orange-200">{mappedCounts.urls}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700/50">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <div>
                        <div className="text-xs text-red-600 dark:text-red-400 font-medium">Vulnerabilities</div>
                        <div className="text-lg font-bold text-red-800 dark:text-red-200">{mappedCounts.vulnerabilities}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end text-right space-y-2">
                <div className="text-sm text-muted-foreground">Generated by</div>
                <div className="text-sm font-semibold">Cybersecurity Engineering Analysis</div>
                <Badge variant="outline" className="glass border-primary/30 text-primary">
                  <Clock className="h-3 w-3 mr-1" />
                  Automated Report
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <main className="relative z-10 px-6 max-w-7xl mx-auto pb-12">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Enhanced Findings Section */}
          <section className="xl:col-span-8 space-y-6">
            <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold text-primary">Security Findings</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Vulnerabilities prioritized by severity level</p>
                  </div>
                </div>
                
                {/* Enhanced Filter Buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50" ref={reportRef}>
                  <Button 
                    onClick={() => handleFilterClick('all')} 
                    variant={activeFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 ${
                      activeFilter === 'all' 
                        ? 'bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/20' 
                        : 'hover:bg-secondary/80'
                    }`}
                  >
                    <Filter className="h-3 w-3 mr-1" />
                    All Issues
                  </Button>
                  
                  <Button 
                    onClick={() => handleFilterClick('critical')} 
                    variant="outline"
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 border-red-300 dark:border-red-700 ${
                      activeFilter === 'critical' 
                        ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-500/20' 
                        : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                    }`}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Critical
                  </Button>
                  
                  <Button 
                    onClick={() => handleFilterClick('high')} 
                    variant="outline"
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 border-orange-300 dark:border-orange-700 ${
                      activeFilter === 'high' 
                        ? 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-500/20' 
                        : 'text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                    }`}
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    High
                  </Button>
                  
                  <Button 
                    onClick={() => handleFilterClick('medium')} 
                    variant="outline"
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 border-yellow-300 dark:border-yellow-700 ${
                      activeFilter === 'medium' 
                        ? 'bg-yellow-500 text-black shadow-lg ring-2 ring-yellow-500/20' 
                        : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                    }`}
                  >
                    <Info className="h-3 w-3 mr-1" />
                    Medium
                  </Button>
                  
                  <Button 
                    onClick={() => handleFilterClick('low')} 
                    variant="outline"
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 border-blue-300 dark:border-blue-700 ${
                      activeFilter === 'low' 
                        ? 'bg-blue-500 text-white shadow-lg ring-2 ring-blue-500/20' 
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Low
                  </Button>
                  
                  <Button 
                    onClick={() => handleFilterClick('info')} 
                    variant="outline"
                    size="sm"
                    className={`interactive rounded-full text-xs font-medium px-4 py-2 border-gray-300 dark:border-gray-700 ${
                      activeFilter === 'info' 
                        ? 'bg-gray-500 text-white shadow-lg ring-2 ring-gray-500/20' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/20'
                    }`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Info
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Critical Vulnerabilities */}
                <div 
                  className={`space-y-4 transition-all duration-300 ${
                    activeFilter === 'all' || activeFilter === 'critical' ? 'block animate-fade-in' : 'hidden'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Critical Vulnerabilities</h3>
                  </div>
                  
                  {critical_severity_vulnerabilities && critical_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {critical_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-red-200 dark:border-red-800 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-900/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    Critical
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Immediate attention required</div>
                                </div>
                              </div>
                              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3">
                              <div className="p-3 bg-card/50 rounded-lg border border-border/30">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Affected Host</div>
                                <div className="text-sm">
                                  {vuln?.affected_hosts && vuln.affected_hosts.length > 0 ? (
                                    <a 
                                      href={typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || '#') : vuln.affected_hosts[0]} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                    >
                                      {typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || 'Unknown') : vuln.affected_hosts[0]}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Description:</span> 
                                  <span className="ml-2 text-muted-foreground">{vuln?.description || 'No description available'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Impact:</span> 
                                  <span className="ml-2 text-muted-foreground">
                                    {vuln?.impact ? 
                                      `Confidentiality: ${vuln.impact.confidentiality}, Integrity: ${vuln.impact.integrity}, Availability: ${vuln.impact.availability}` : 
                                      'Impact not specified'
                                    }
                                  </span>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                  <div className="font-medium text-red-800 dark:text-red-200 text-xs mb-1">Recommended Actions</div>
                                  <div className="text-red-700 dark:text-red-300 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">No critical vulnerabilities found</div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* High Vulnerabilities */}
                <div 
                  className={`space-y-4 transition-all duration-300 ${
                    activeFilter === 'all' || activeFilter === 'high' ? 'block animate-fade-in' : 'hidden'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                    <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400">High Severity Vulnerabilities</h3>
                  </div>
                  
                  {high_severity_vulnerabilities && high_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {high_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50/50 to-transparent dark:from-orange-900/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    High
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Prompt attention required</div>
                                </div>
                              </div>
                              <TrendingUp className="h-5 w-5 text-orange-500 flex-shrink-0" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3">
                              <div className="p-3 bg-card/50 rounded-lg border border-border/30">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Affected Host</div>
                                <div className="text-sm">
                                  {vuln?.affected_hosts && vuln.affected_hosts.length > 0 ? (
                                    <a 
                                      href={typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || '#') : vuln.affected_hosts[0]} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                    >
                                      {typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || 'Unknown') : vuln.affected_hosts[0]}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Description:</span> 
                                  <span className="ml-2 text-muted-foreground">{vuln?.description || 'No description available'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Impact:</span> 
                                  <span className="ml-2 text-muted-foreground">
                                    {vuln?.impact ? 
                                      `Confidentiality: ${vuln.impact.confidentiality}, Integrity: ${vuln.impact.integrity}, Availability: ${vuln.impact.availability}` : 
                                      'Impact not specified'
                                    }
                                  </span>
                                </div>
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                                  <div className="font-medium text-orange-800 dark:text-orange-200 text-xs mb-1">Recommended Actions</div>
                                  <div className="text-orange-700 dark:text-orange-300 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">No high severity vulnerabilities found</div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Medium Vulnerabilities */}
                <div 
                  className={`space-y-4 transition-all duration-300 ${
                    activeFilter === 'all' || activeFilter === 'medium' ? 'block animate-fade-in' : 'hidden'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <h3 className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Medium Severity Vulnerabilities</h3>
                  </div>
                  
                  {medium_severity_vulnerabilities && medium_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {medium_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-yellow-200 dark:border-yellow-800 bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    Medium
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Schedule for review</div>
                                </div>
                              </div>
                              <Info className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3">
                              <div className="p-3 bg-card/50 rounded-lg border border-border/30">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Affected Host</div>
                                <div className="text-sm">
                                  {vuln?.affected_hosts && vuln.affected_hosts.length > 0 ? (
                                    <a 
                                      href={vuln.affected_hosts[0]} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                    >
                                      {vuln.affected_hosts[0]}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Description:</span> 
                                  <span className="ml-2 text-muted-foreground">{vuln?.description || 'No description available'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Impact:</span> 
                                  <span className="ml-2 text-muted-foreground">
                                    {vuln?.impact ? 
                                      `Confidentiality: ${vuln.impact.confidentiality}, Integrity: ${vuln.impact.integrity}, Availability: ${vuln.impact.availability}` : 
                                      'Impact not specified'
                                    }
                                  </span>
                                </div>
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                  <div className="font-medium text-yellow-800 dark:text-yellow-200 text-xs mb-1">Recommended Actions</div>
                                  <div className="text-yellow-700 dark:text-yellow-300 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">No medium severity vulnerabilities found</div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Low & Info Vulnerabilities */}
                <div 
                  className={`space-y-4 transition-all duration-300 ${
                    activeFilter === 'all' || activeFilter === 'low' || activeFilter === 'info' ? 'block animate-fade-in' : 'hidden'
                  }`}
                >
                  <div className="flex items-center gap-2 pb-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">Low Severity & Informational</h3>
                  </div>
                  
                  {low_severity_vulnerabilities && low_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {low_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    Low
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Monitor and document</div>
                                </div>
                              </div>
                              <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3">
                              <div className="p-3 bg-card/50 rounded-lg border border-border/30">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Affected Host</div>
                                <div className="text-sm">
                                  {vuln?.affected_hosts && vuln.affected_hosts.length > 0 ? (
                                    <a 
                                      href={vuln.affected_hosts[0]} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                    >
                                      {vuln.affected_hosts[0]}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Description:</span> 
                                  <span className="ml-2 text-muted-foreground">{vuln?.description || 'No description available'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Impact:</span> 
                                  <span className="ml-2 text-muted-foreground">
                                    {vuln?.impact ? 
                                      `Confidentiality: ${vuln.impact.confidentiality}, Integrity: ${vuln.impact.integrity}, Availability: ${vuln.impact.availability}` : 
                                      'Impact not specified'
                                    }
                                  </span>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="font-medium text-blue-800 dark:text-blue-200 text-xs mb-1">Recommended Actions</div>
                                  <div className="text-blue-700 dark:text-blue-300 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">No low severity vulnerabilities found</div>
                      </div>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Enhanced Assets & Summary Section */}
          <aside className="xl:col-span-4 space-y-6">
            <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-xl text-primary">Asset Discovery</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">Identified infrastructure and services</p>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Subdomains Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Discovered Subdomains</h4>
                    <Badge variant="outline" className="ml-auto text-xs">{subdomains?.length || 0}</Badge>
                  </div>
                  <div className="glass rounded-lg p-4 max-h-48 overflow-auto scrollable border border-border/30">
                    {subdomains && subdomains.length > 0 ? (
                      <div className="space-y-2">
                        {subdomains.map((subdomain, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-card/50 rounded border border-border/20 hover:bg-card/70 transition-colors">
                            <code className="text-xs text-muted-foreground font-mono">
                              {typeof subdomain === 'object' ? (subdomain.domain || 'Unknown') : (subdomain || 'Unknown')}
                            </code>
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No subdomains discovered
                      </div>
                    )}
                  </div>
                </div>

                {/* Technologies Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="text-sm font-semibold text-purple-600 dark:text-purple-400">Detected Technologies</h4>
                  </div>
                  <div className="glass rounded-lg p-4 border border-border/30">
                    {subdomains && subdomains.some(sub => sub.technologies && sub.technologies.length > 0) ? (
                      <div className="space-y-3">
                        {subdomains.flatMap(sub => 
                          sub.technologies ? sub.technologies.map((tech, techIndex) => (
                            <div key={`${sub.domain}-${techIndex}`} className="p-3 bg-card/50 rounded border border-border/20">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{sub.domain}</span>
                                <Badge variant="outline" className="text-xs">
                                  {tech?.name || 'Unknown'}
                                </Badge>
                              </div>
                              {tech?.version && (
                                <div className="text-xs text-muted-foreground">Version: {tech.version}</div>
                              )}
                            </div>
                          )) : []
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No technologies detected
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Hosts Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <h4 className="text-sm font-semibold text-green-600 dark:text-green-400">Live Hosts</h4>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {subdomains?.filter(subdomain => subdomain.resolved_ip).length || 0}
                    </Badge>
                  </div>
                  <div className="glass rounded-lg p-4 border border-border/30">
                    {subdomains && subdomains.filter(subdomain => subdomain.resolved_ip).length > 0 ? (
                      <div className="space-y-2">
                        {subdomains.filter(subdomain => subdomain.resolved_ip).map((host, index) => (
                          <div key={index} className="p-3 bg-card/50 rounded border border-border/20">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{host.domain}</span>
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span className="text-xs text-green-600 dark:text-green-400">Live</span>
                              </div>
                            </div>
                            <code className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded font-mono">
                              {host.resolved_ip}
                            </code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No live hosts identified
                      </div>
                    )}
                  </div>
                </div>

                {/* Ports Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <ExternalLink className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <h4 className="text-sm font-semibold text-orange-600 dark:text-orange-400">Open Ports</h4>
                    <Badge variant="outline" className="ml-auto text-xs">{ports?.length || 0}</Badge>
                  </div>
                  <div className="glass rounded-lg p-4 border border-border/30">
                    {ports && ports.length > 0 ? (
                      <div className="space-y-2">
                        {ports.slice(0, 8).map((port, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-card/50 rounded border border-border/20">
                            <div className="flex items-center gap-3">
                              <code className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-2 py-1 rounded font-mono">
                                {port?.port || 'Unknown'}
                              </code>
                              <span className="text-xs text-muted-foreground">{port?.host || 'Unknown host'}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">TCP</Badge>
                          </div>
                        ))}
                        {ports.length > 8 && (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            ... and {ports.length - 8} more ports
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No open ports detected
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Enhanced Recommendations Section */}
        <div className="mt-12">
          <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl text-primary">Security Recommendations</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Prioritized action items for remediation</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Immediate Recommendations */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-red-200 dark:border-red-800">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-red-600 dark:text-red-400">Immediate Actions (0–24h)</h4>
                    <p className="text-xs text-red-500 dark:text-red-400">Critical security issues requiring immediate attention</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recommendations?.immediate && recommendations.immediate.length > 0 ? (
                    recommendations.immediate.map((rec, index) => (
                      <div key={index} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 hover-lift">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                          <div className="text-sm text-red-800 dark:text-red-200">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="text-sm text-green-700 dark:text-green-300 font-medium">No immediate actions required</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Short-term Recommendations */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-orange-200 dark:border-orange-800">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-orange-600 dark:text-orange-400">Short-term Actions (1–2 weeks)</h4>
                    <p className="text-xs text-orange-500 dark:text-orange-400">Important security improvements to schedule</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recommendations?.short_term && recommendations.short_term.length > 0 ? (
                    recommendations.short_term.map((rec, index) => (
                      <div key={index} className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 hover-lift">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                          <div className="text-sm text-orange-800 dark:text-orange-200">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <div className="text-sm text-gray-700 dark:text-gray-300">No short-term recommendations available</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Medium-term Recommendations */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-green-200 dark:border-green-800">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-green-600 dark:text-green-400">Medium-term Actions (3–8 weeks)</h4>
                    <p className="text-xs text-green-500 dark:text-green-400">Strategic security enhancements for long-term posture</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recommendations?.medium_term && recommendations.medium_term.length > 0 ? (
                    recommendations.medium_term.map((rec, index) => (
                      <div key={index} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover-lift">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                          <div className="text-sm text-green-800 dark:text-green-200">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        <div className="text-sm text-gray-700 dark:text-gray-300">No medium-term recommendations available</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default FinalReport;