import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Zap,
  Target,
  Lock,
  Eye,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const StyleDemo = () => {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold gradient-primary bg-clip-text text-transparent">
          Enhanced Security Dashboard Styles
        </h1>
        <p className="text-muted-foreground text-lg">
          Comprehensive styling enhancements for your security dashboard
        </p>
      </div>

      {/* Color Palette Demo */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Enhanced Color Palette
          </CardTitle>
          <CardDescription>
            Security-focused color scheme with improved contrast and accessibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vulnerability Severity Colors */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Vulnerability Severity Levels</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="status-critical p-4 rounded-lg text-center">
                <div className="text-lg font-bold">Critical</div>
                <div className="text-sm opacity-90">Immediate Action</div>
              </div>
              <div className="status-high p-4 rounded-lg text-center">
                <div className="text-lg font-bold">High</div>
                <div className="text-sm opacity-90">Priority Fix</div>
              </div>
              <div className="status-medium p-4 rounded-lg text-center">
                <div className="text-lg font-bold">Medium</div>
                <div className="text-sm opacity-90">Schedule Fix</div>
              </div>
              <div className="status-low p-4 rounded-lg text-center">
                <div className="text-lg font-bold">Low</div>
                <div className="text-sm opacity-90">Monitor</div>
              </div>
              <div className="status-info p-4 rounded-lg text-center">
                <div className="text-lg font-bold">Info</div>
                <div className="text-sm opacity-90">Reference</div>
              </div>
            </div>
          </div>

          {/* Vulnerability Badges */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Vulnerability Badges</h3>
            <div className="flex flex-wrap gap-2">
              <Badge className="vulnerability-critical">Critical Risk</Badge>
              <Badge className="vulnerability-high">High Risk</Badge>
              <Badge className="vulnerability-medium">Medium Risk</Badge>
              <Badge className="vulnerability-low">Low Risk</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Button Variants */}
      <Card className="hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            Enhanced Button Components
          </CardTitle>
          <CardDescription>
            Interactive buttons with hover effects and improved accessibility
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="success">Success</Button>
            <Button variant="warning">Warning</Button>
            <Button variant="destructive">Danger</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="space-x-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>
        </CardContent>
      </Card>

      {/* Gradient Backgrounds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Custom Gradient Backgrounds
          </CardTitle>
          <CardDescription>
            Security-themed gradients for visual hierarchy and branding
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="gradient-primary p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Primary Gradient</h4>
              <p className="text-sm opacity-90">Main brand colors</p>
            </div>
            <div className="gradient-security p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Security Gradient</h4>
              <p className="text-sm opacity-90">Trust & reliability</p>
            </div>
            <div className="gradient-cyber p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Cyber Gradient</h4>
              <p className="text-sm opacity-90">Technology focus</p>
            </div>
            <div className="gradient-alert p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Alert Gradient</h4>
              <p className="text-sm opacity-90">Warnings & alerts</p>
            </div>
            <div className="gradient-success p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Success Gradient</h4>
              <p className="text-sm opacity-90">Positive states</p>
            </div>
            <div className="gradient-dark p-6 rounded-lg text-white text-center">
              <h4 className="font-semibold">Dark Gradient</h4>
              <p className="text-sm opacity-90">Professional look</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Elements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Interactive Elements & Animations
          </CardTitle>
          <CardDescription>
            Micro-interactions and hover effects for better user experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hover Effects */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Hover Effects</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="dashboard-card interactive">
                <Lock className="h-8 w-8 mb-2 text-primary" />
                <h4 className="font-semibold">Hover Lift</h4>
                <p className="text-sm text-muted-foreground">Elevates on hover</p>
              </div>
              <div className="dashboard-card hover-glow">
                <Shield className="h-8 w-8 mb-2 text-success" />
                <h4 className="font-semibold">Hover Glow</h4>
                <p className="text-sm text-muted-foreground">Glows on hover</p>
              </div>
              <div className="dashboard-card interactive-subtle">
                <AlertTriangle className="h-8 w-8 mb-2 text-warning" />
                <h4 className="font-semibold">Subtle Hover</h4>
                <p className="text-sm text-muted-foreground">Gentle highlight</p>
              </div>
            </div>
          </div>

          {/* Loading States */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Loading States</h3>
            <div className="space-y-3">
              <div className="skeleton-title"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-text w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Glassmorphism Effects */}
      <div className="gradient-mesh p-8 rounded-xl">
        <Card className="glass-strong">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Glassmorphism Cards
            </CardTitle>
            <CardDescription>
              Modern glass-like effects with backdrop blur
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Security Score</h4>
                      <p className="text-2xl font-bold text-success">87%</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-success" />
                  </div>
                </CardContent>
              </Card>
              <Card className="glass">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">Active Threats</h4>
                      <p className="text-2xl font-bold text-destructive">3</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert Components */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Enhanced Alert Components
          </CardTitle>
          <CardDescription>
            Improved alerts with better visual hierarchy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-destructive/50 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Critical vulnerability detected in main server. Immediate action required.
            </AlertDescription>
          </Alert>
          <Alert className="border-warning/50 text-warning">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Scheduled maintenance will begin in 30 minutes.
            </AlertDescription>
          </Alert>
          <Alert className="border-success/50 text-success">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              All security scans completed successfully. No threats detected.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Typography */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Enhanced Typography
          </CardTitle>
          <CardDescription>
            Improved font hierarchy and readability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold">Heading 1 - Dashboard Title</h1>
            <h2 className="text-3xl font-semibold">Heading 2 - Section Title</h2>
            <h3 className="text-2xl font-semibold">Heading 3 - Card Title</h3>
            <h4 className="text-xl font-medium">Heading 4 - Subsection</h4>
            <p className="text-base">Body text with improved line height and spacing for better readability.</p>
            <p className="text-sm text-muted-foreground">Muted text for secondary information and descriptions.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StyleDemo;