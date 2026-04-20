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
  Eye,
  Filter,
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
      
      {/* Mobile-optimized Back button */}
      <div className="relative z-10 p-4 sm:p-6">
        <Button 
          variant="outline" 
          onClick={handleBackClick}
          className="mb-4 sm:mb-6 hover-lift focus-ring bg-card/80 backdrop-blur-sm border-border/60 w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </div>

      {/* Mobile-responsive Header */}
      <div className="relative z-10 mb-6 sm:mb-8">
        <Card className="mx-4 sm:mx-6 glass-strong shadow-xl border-border/30 animate-fade-in-down">
          <CardHeader className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
            <div className="flex flex-col space-y-4 lg:space-y-6">
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
                    Security Recon Report
                  </CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                    <span className="text-lg sm:text-xl lg:text-2xl font-extrabold text-primary break-all">{metadata?.domain || 'Domain'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span>Scan generated: {new Date(metadata?.scan_start || new Date()).toLocaleDateString()}</span>
                </div>

                {/* Mobile-optimized Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 sm:mt-6">
                  <div className="dashboard-card bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30 border-primary/30 dark:border-primary/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-primary font-medium truncate">Subdomains</div>
                        <div className="text-lg sm:text-xl font-bold text-primary">{mappedCounts.subdomains}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-success/10 to-success/20 dark:from-success/20 dark:to-success/30 border-success/30 dark:border-success/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-success/20 rounded-lg flex-shrink-0">
                        <Activity className="h-4 w-4 text-success" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-success font-medium truncate">Live Hosts</div>
                        <div className="text-lg sm:text-xl font-bold text-success">{mappedCounts.hosts}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-secondary/10 to-secondary/20 dark:from-secondary/20 dark:to-secondary/30 border-secondary/30 dark:border-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-secondary/20 rounded-lg flex-shrink-0">
                        <Target className="h-4 w-4 text-secondary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-secondary font-medium truncate">Ports</div>
                        <div className="text-lg sm:text-xl font-bold text-secondary">{mappedCounts.ports}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-accent/10 to-accent/20 dark:from-accent/20 dark:to-accent/30 border-accent/30 dark:border-accent/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/20 rounded-lg flex-shrink-0">
                        <ExternalLink className="h-4 w-4 text-accent" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-accent font-medium truncate">URLs</div>
                        <div className="text-lg sm:text-xl font-bold text-accent">{mappedCounts.urls}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card bg-gradient-to-br from-destructive/10 to-destructive/20 dark:from-destructive/20 dark:to-destructive/30 border-destructive/30 dark:border-destructive/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-destructive/20 rounded-lg flex-shrink-0">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-destructive font-medium truncate">Vulnerabilities</div>
                        <div className="text-lg sm:text-xl font-bold text-destructive">{mappedCounts.vulnerabilities}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pt-4 border-t border-border/30">
                <div className="text-xs sm:text-sm text-muted-foreground">Generated by Cybersecurity Engineering Analysis</div>
                <Badge variant="outline" className="glass border-primary/30 text-primary self-start sm:self-end">
                  <Clock className="h-3 w-3 mr-1" />
                  Automated Report
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      <main className="relative z-10 px-4 sm:px-6 max-w-7xl mx-auto pb-8 sm:pb-12">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
          {/* Mobile-optimized Findings Section */}
          <section className="xl:col-span-8 space-y-4 sm:space-y-6">
            <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg sm:text-xl font-semibold text-primary">Security Findings</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vulnerabilities prioritized by severity level</p>
                  </div>
                </div>
                
                {/* Mobile-friendly Filter Buttons */}
                <div className="pt-3 sm:pt-4 border-t border-border/50" ref={reportRef}>
                  {/* Mobile: Show filters in a scrollable horizontal row */}
                  <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap scrollbar-hide">
                    <Button 
                      onClick={() => handleFilterClick('all')} 
                      variant={activeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 ${
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
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 border-destructive/30 dark:border-destructive/70 ${
                        activeFilter === 'critical' 
                          ? 'bg-destructive text-destructive-foreground shadow-lg ring-2 ring-destructive/20' 
                          : 'text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20'
                      }`}
                    >
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Critical
                    </Button>
                    
                    <Button 
                      onClick={() => handleFilterClick('high')} 
                      variant="outline"
                      size="sm"
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 border-warning/30 dark:border-warning/70 ${
                        activeFilter === 'high' 
                          ? 'bg-warning text-warning-foreground shadow-lg ring-2 ring-warning/20' 
                          : 'text-warning hover:bg-warning/10 dark:hover:bg-warning/20'
                      }`}
                    >
                      <TrendingUp className="h-3 w-3 mr-1" />
                      High
                    </Button>
                    
                    <Button 
                      onClick={() => handleFilterClick('medium')} 
                      variant="outline"
                      size="sm"
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 border-yellow-400/30 dark:border-yellow-500/70 ${
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
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 border-success/30 dark:border-success/70 ${
                        activeFilter === 'low' 
                          ? 'bg-success text-success-foreground shadow-lg ring-2 ring-success/20' 
                          : 'text-success hover:bg-success/10 dark:hover:bg-success/20'
                      }`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Low
                    </Button>
                    
                    <Button 
                      onClick={() => handleFilterClick('info')} 
                      variant="outline"
                      size="sm"
                      className={`interactive rounded-full text-xs font-medium px-3 sm:px-4 py-2 whitespace-nowrap flex-shrink-0 border-muted/50 dark:border-muted/70 ${
                        activeFilter === 'info' 
                          ? 'bg-muted text-muted-foreground shadow-lg ring-2 ring-muted/20' 
                          : 'text-muted-foreground hover:bg-muted/50 dark:hover:bg-muted/30'
                      }`}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Info
                    </Button>
                  </div>
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
                    <div className="w-3 h-3 rounded-full bg-destructive"></div>
                    <h3 className="text-lg font-semibold text-destructive">Critical Vulnerabilities</h3>
                  </div>
                  
                  {critical_severity_vulnerabilities && critical_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                      {critical_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-destructive/30 dark:border-destructive/50 bg-gradient-to-r from-destructive/10 to-transparent dark:from-destructive/20 dark:to-transparent hover-lift animate-fade-in-up mobile-card-spacing" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-2 sm:pb-3">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm sm:text-base font-semibold text-foreground break-words">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                                  <Badge className="bg-destructive hover:bg-destructive/80 text-destructive-foreground px-2 sm:px-3 py-1 rounded-full text-xs font-bold shadow-sm self-start">
                                    Critical
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Immediate attention required</div>
                                </div>
                              </div>
                              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0 self-start sm:self-center" />
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3 pt-0">
                            <div className="grid gap-3">
                              <div className="p-3 bg-card/50 rounded-lg border border-border/30">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Affected Host</div>
                                <div className="text-sm break-all">
                                  {vuln?.affected_hosts && vuln.affected_hosts.length > 0 ? (
                                    <a 
                                      href={typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || '#') : vuln.affected_hosts[0]} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-primary hover:underline font-medium inline-flex items-start sm:items-center gap-1 flex-wrap"
                                    >
                                      <span className="break-all">
                                        {typeof vuln.affected_hosts[0] === 'object' ? (vuln.affected_hosts[0].domain || vuln.affected_hosts[0].url || 'Unknown') : vuln.affected_hosts[0]}
                                      </span>
                                      <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 sm:mt-0" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">Unknown</span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2 text-xs sm:text-sm">
                                <div>
                                  <span className="font-medium text-foreground">Description:</span> 
                                  <span className="ml-2 text-muted-foreground break-words">{vuln?.description || 'No description available'}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-foreground">Impact:</span> 
                                  <span className="ml-2 text-muted-foreground break-words">
                                    {vuln?.impact ? 
                                      `Confidentiality: ${vuln.impact.confidentiality}, Integrity: ${vuln.impact.integrity}, Availability: ${vuln.impact.availability}` : 
                                      'Impact not specified'
                                    }
                                  </span>
                                </div>
                                <div className="p-3 bg-destructive/10 dark:bg-destructive/20 rounded-lg border border-destructive/30 dark:border-destructive/50">
                                  <div className="font-medium text-destructive text-xs mb-1">Recommended Actions</div>
                                  <div className="text-destructive/80 text-xs sm:text-sm break-words">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div className="text-sm text-success font-medium">No critical vulnerabilities found</div>
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
                    <div className="w-3 h-3 rounded-full bg-warning"></div>
                    <h3 className="text-lg font-semibold text-warning">High Severity Vulnerabilities</h3>
                  </div>
                  
                  {high_severity_vulnerabilities && high_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {high_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-warning/30 dark:border-warning/50 bg-gradient-to-r from-warning/10 to-transparent dark:from-warning/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-warning hover:bg-warning/80 text-warning-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    High
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Prompt attention required</div>
                                </div>
                              </div>
                              <TrendingUp className="h-5 w-5 text-warning flex-shrink-0" />
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
                                <div className="p-3 bg-warning/10 dark:bg-warning/20 rounded-lg border border-warning/30 dark:border-warning/50">
                                  <div className="font-medium text-warning text-xs mb-1">Recommended Actions</div>
                                  <div className="text-warning/80 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div className="text-sm text-success font-medium">No high severity vulnerabilities found</div>
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
                    <Card className="p-6 bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div className="text-sm text-success font-medium">No medium severity vulnerabilities found</div>
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
                    <div className="w-3 h-3 rounded-full bg-success"></div>
                    <h3 className="text-lg font-semibold text-success">Low Severity & Informational</h3>
                  </div>
                  
                  {low_severity_vulnerabilities && low_severity_vulnerabilities.length > 0 ? (
                    <div className="space-y-4">
                      {low_severity_vulnerabilities.map((vuln, index) => (
                        <Card key={index} className="border-success/30 dark:border-success/50 bg-gradient-to-r from-success/10 to-transparent dark:from-success/20 dark:to-transparent hover-lift animate-fade-in-up" style={{animationDelay: `${index * 100}ms`}}>
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start gap-3">
                              <div className="flex-1">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {vuln?.title || vuln?.id || 'Unknown Vulnerability'}
                                </CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className="bg-success hover:bg-success/80 text-success-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                    Low
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">Monitor and document</div>
                                </div>
                              </div>
                              <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
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
                                <div className="p-3 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30 dark:border-success/50">
                                  <div className="font-medium text-success text-xs mb-1">Recommended Actions</div>
                                  <div className="text-success/80 text-sm">{vuln?.remediation || 'No recommendations available'}</div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="p-6 bg-success/10 dark:bg-success/20 border-success/30 dark:border-success/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div className="text-sm text-success font-medium">No low severity vulnerabilities found</div>
                      </div>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Mobile-responsive Assets & Summary Section */}
          <aside className="xl:col-span-4 space-y-4 sm:space-y-6">
            <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
              <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg sm:text-xl text-primary">Asset Discovery</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">Identified infrastructure and services</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4 sm:space-y-6">
                {/* Mobile-optimized Subdomains Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      <h4 className="text-xs sm:text-sm font-semibold text-primary">Discovered Subdomains</h4>
                    </div>
                    <Badge variant="outline" className="text-xs">{subdomains?.length || 0}</Badge>
                  </div>
                  <div className="glass rounded-lg p-3 sm:p-4 max-h-48 overflow-auto scrollable border border-border/30">
                    {subdomains && subdomains.length > 0 ? (
                      <div className="space-y-2">
                        {subdomains.map((subdomain, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-card/50 rounded border border-border/20 hover:bg-card/70 transition-colors">
                            <code className="text-xs text-muted-foreground font-mono break-all flex-1 mr-2">
                              {typeof subdomain === 'object' ? (subdomain.domain || 'Unknown') : (subdomain || 'Unknown')}
                            </code>
                            <div className="w-2 h-2 rounded-full bg-success flex-shrink-0"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs sm:text-sm py-4">
                        <Globe className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                        No subdomains discovered
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile-optimized Technologies Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/30">
                    <Target className="h-3 w-3 sm:h-4 sm:w-4 text-secondary flex-shrink-0" />
                    <h4 className="text-xs sm:text-sm font-semibold text-secondary">Detected Technologies</h4>
                  </div>
                  <div className="glass rounded-lg p-3 sm:p-4 border border-border/30">
                    {subdomains && subdomains.some(sub => sub.technologies && sub.technologies.length > 0) ? (
                      <div className="space-y-3">
                        {subdomains.flatMap(sub => 
                          sub.technologies ? sub.technologies.map((tech, techIndex) => (
                            <div key={`${sub.domain}-${techIndex}`} className="p-2 sm:p-3 bg-card/50 rounded border border-border/20">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-1">
                                <span className="font-medium text-xs sm:text-sm break-all">{sub.domain}</span>
                                <Badge variant="outline" className="text-xs self-start sm:self-center">
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
                      <div className="text-center text-muted-foreground text-xs sm:text-sm py-4">
                        <Target className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                        No technologies detected
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile-optimized Live Hosts Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-success flex-shrink-0" />
                      <h4 className="text-xs sm:text-sm font-semibold text-success">Live Hosts</h4>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {subdomains?.filter(subdomain => subdomain.resolved_ip).length || 0}
                    </Badge>
                  </div>
                  <div className="glass rounded-lg p-3 sm:p-4 border border-border/30">
                    {subdomains && subdomains.filter(subdomain => subdomain.resolved_ip).length > 0 ? (
                      <div className="space-y-2">
                        {subdomains.filter(subdomain => subdomain.resolved_ip).map((host, index) => (
                          <div key={index} className="p-2 sm:p-3 bg-card/50 rounded border border-border/20">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-1">
                              <span className="font-medium text-xs sm:text-sm break-all">{host.domain}</span>
                              <div className="flex items-center gap-1 self-start sm:self-center">
                                <div className="w-2 h-2 rounded-full bg-success flex-shrink-0"></div>
                                <span className="text-xs text-success">Live</span>
                              </div>
                            </div>
                            <code className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded font-mono break-all">
                              {host.resolved_ip}
                            </code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs sm:text-sm py-4">
                        <Activity className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                        No live hosts identified
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile-optimized Ports Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border/30">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 text-accent flex-shrink-0" />
                      <h4 className="text-xs sm:text-sm font-semibold text-accent">Open Ports</h4>
                    </div>
                    <Badge variant="outline" className="text-xs">{ports?.length || 0}</Badge>
                  </div>
                  <div className="glass rounded-lg p-3 sm:p-4 border border-border/30">
                    {ports && ports.length > 0 ? (
                      <div className="space-y-2">
                        {ports.slice(0, 8).map((port, index) => (
                          <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 bg-card/50 rounded border border-border/20 gap-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <code className="text-xs bg-accent/20 dark:bg-accent/30 text-accent px-2 py-1 rounded font-mono flex-shrink-0">
                                {port?.port || 'Unknown'}
                              </code>
                              <span className="text-xs text-muted-foreground break-all">{port?.host || 'Unknown host'}</span>
                            </div>
                            <Badge variant="outline" className="text-xs self-start sm:self-center">TCP</Badge>
                          </div>
                        ))}
                        {ports.length > 8 && (
                          <div className="text-xs text-muted-foreground text-center py-2">
                            ... and {ports.length - 8} more ports
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground text-xs sm:text-sm py-4">
                        <ExternalLink className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                        No open ports detected
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>

        {/* Mobile-responsive Recommendations Section */}
        <div className="mt-8 sm:mt-12">
          <Card className="glass-strong shadow-xl border-border/30 animate-fade-in-up hover-lift">
            <CardHeader className="pb-3 sm:pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg sm:text-xl text-primary">Security Recommendations</CardTitle>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Prioritized action items for remediation</p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6 sm:space-y-8">
              {/* Mobile-optimized Immediate Recommendations */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-3 pb-2 sm:pb-3 border-b border-destructive/30 dark:border-destructive/50">
                  <div className="p-1.5 sm:p-2 bg-destructive/10 dark:bg-destructive/20 rounded-lg flex-shrink-0">
                    <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm sm:text-base font-semibold text-destructive">Immediate Actions (0–24h)</h4>
                    <p className="text-xs text-destructive/80">Critical security issues requiring immediate attention</p>
                  </div>
                </div>
                
                <div className="space-y-2 sm:space-y-3">
                  {recommendations?.immediate && recommendations.immediate.length > 0 ? (
                    recommendations.immediate.map((rec, index) => (
                      <div key={index} className="p-3 sm:p-4 bg-destructive/10 dark:bg-destructive/20 rounded-lg border border-destructive/30 dark:border-destructive/50 hover-lift">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="w-2 h-2 rounded-full bg-destructive mt-1.5 sm:mt-2 flex-shrink-0"></div>
                          <div className="text-xs sm:text-sm text-destructive/90 break-words">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 sm:p-4 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30 dark:border-success/50">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div className="text-sm text-success font-medium">No immediate actions required</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Short-term Recommendations */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-warning/30 dark:border-warning/50">
                  <div className="p-2 bg-warning/10 dark:bg-warning/20 rounded-lg">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-warning">Short-term Actions (1–2 weeks)</h4>
                    <p className="text-xs text-warning/80">Important security improvements to schedule</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recommendations?.short_term && recommendations.short_term.length > 0 ? (
                    recommendations.short_term.map((rec, index) => (
                      <div key={index} className="p-4 bg-warning/10 dark:bg-warning/20 rounded-lg border border-warning/30 dark:border-warning/50 hover-lift">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-warning mt-2 flex-shrink-0"></div>
                          <div className="text-sm text-warning/90">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-muted/50 dark:bg-muted rounded-lg border border-muted dark:border-muted">
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        <div className="text-sm text-muted-foreground">No short-term recommendations available</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Medium-term Recommendations */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-success/30 dark:border-success/50">
                  <div className="p-2 bg-success/10 dark:bg-success/20 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-success">Medium-term Actions (3–8 weeks)</h4>
                    <p className="text-xs text-success/80">Strategic security enhancements for long-term posture</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {recommendations?.medium_term && recommendations.medium_term.length > 0 ? (
                    recommendations.medium_term.map((rec, index) => (
                      <div key={index} className="p-4 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30 dark:border-success/50 hover-lift">
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-success mt-2 flex-shrink-0"></div>
                          <div className="text-sm text-success/90">
                            {typeof rec === 'object' ? (rec.domain || rec.text || 'Unknown recommendation') : (rec || 'No details provided')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 bg-muted/50 dark:bg-muted rounded-lg border border-muted dark:border-muted">
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-muted-foreground" />
                        <div className="text-sm text-muted-foreground">No medium-term recommendations available</div>
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