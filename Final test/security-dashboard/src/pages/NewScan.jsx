import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Loader2, AlertCircle, Target, Shield, Info } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { createScan } from '../services/scanService';

const TOOL_OPTIONS = [
  { value: 'subfinder', label: 'subfinder', description: 'Passive subdomain discovery' },
  { value: 'amass', label: 'amass', description: 'Additional asset enumeration' },
  { value: 'nmap', label: 'nmap', description: 'Service and port fingerprinting' },
  { value: 'masscan', label: 'masscan', description: 'Fast broad port scanning' },
  { value: 'nuclei', label: 'nuclei', description: 'Template-based vulnerability checks' },
  { value: 'ffuf', label: 'ffuf', description: 'Web content discovery' },
  { value: 'gobuster', label: 'gobuster', description: 'Directory/file brute-force coverage' },
];

const PROFILE_PRESETS = {
  standard: {
    orchestrationMode: 'auto',
    maxParallel: '0',
    maxSteps: '0',
  },
  quick: {
    orchestrationMode: 'sequential',
    maxParallel: '1',
    maxSteps: '3',
  },
  custom: null,
};

const EXECUTION_DEFAULTS = {
  orchestrationMode: 'auto',
  maxParallel: '0',
  retries: '2',
  backoff: '2',
  timeout: '900',
  maxSteps: '0',
  useAllTools: true,
  onlyTools: [],
};

const normalizeCheckbox = (checked) => checked === true;

const FieldHelp = ({ text, position = 'bottom' }) => {
  const isTop = position === 'top';

  return (
    <span className="relative inline-flex items-center group">
      <button
        type="button"
        aria-label="Field help"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <Info className="h-3 w-3" />
      </button>
      <span
        className={`pointer-events-none absolute left-1/2 z-30 w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          isTop ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}
      >
        <span
          className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-slate-200 bg-white ${
            isTop ? '-bottom-1 border-b border-r' : '-top-1 border-l border-t'
          }`}
        />
        {text}
      </span>
    </span>
  );
};

const LabelWithHelp = ({ htmlFor, label, helpText }) => (
  <div className="flex items-center gap-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    <FieldHelp text={helpText} />
  </div>
);

const NewScan = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('target');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [scanStarted, setScanStarted] = useState(false);
  const [createdScan, setCreatedScan] = useState(null);

  const [formData, setFormData] = useState({
    scanName: '',
    target: '',
    scanProfile: 'standard',
    enableCustomTuning: false,
    plannerEngine: 'rules',
    orchestrationMode: 'auto',
    maxParallel: '0',
    retries: '2',
    backoff: '2',
    timeout: '900',
    maxSteps: '0',
    useAllTools: true,
    onlyTools: [],
    authorizationAck: true,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleScanProfileChange = (value) => {
    setFormData((prev) => {
      const preset = PROFILE_PRESETS[value];
      if (!preset) {
        return {
          ...prev,
          scanProfile: value,
          enableCustomTuning: false,
        };
      }

      return {
        ...prev,
        scanProfile: value,
        enableCustomTuning: false,
        ...preset,
      };
    });

    if (value === 'custom') {
      setActiveTab('target');
    }
  };

  const handleCustomTuningToggle = (checked) => {
    const enabled = normalizeCheckbox(checked);
    setFormData((prev) => ({
      ...prev,
      enableCustomTuning: enabled,
    }));

    if (enabled) {
      setActiveTab('execution');
      return;
    }

    if (activeTab === 'execution') {
      setActiveTab('target');
    }
  };

  const getEffectiveExecutionSettings = () => {
    const useDefaults = formData.scanProfile === 'custom' && !formData.enableCustomTuning;
    if (useDefaults) {
      return { ...EXECUTION_DEFAULTS };
    }

    return {
      orchestrationMode: formData.orchestrationMode,
      maxParallel: formData.maxParallel,
      retries: formData.retries,
      backoff: formData.backoff,
      timeout: formData.timeout,
      maxSteps: formData.maxSteps,
      useAllTools: formData.useAllTools,
      onlyTools: formData.onlyTools,
    };
  };

  const handleToolToggle = (toolValue) => {
    setFormData((prev) => {
      const exists = prev.onlyTools.includes(toolValue);
      return {
        ...prev,
        onlyTools: exists
          ? prev.onlyTools.filter((item) => item !== toolValue)
          : [...prev.onlyTools, toolValue],
      };
    });
  };

  const validateIntegerRange = (label, rawValue, min, max) => {
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      setError(`${label} must be an integer between ${min} and ${max}`);
      return null;
    }
    return parsed;
  };

  const validateForm = () => {
    if (!formData.scanName.trim()) {
      setError('Scan name is required');
      return false;
    }
    
    if (!formData.target.trim()) {
      setError('Target is required');
      return false;
    }

    if (!formData.authorizationAck) {
      setError('Authorization acknowledgement is required');
      return false;
    }

    const execution = getEffectiveExecutionSettings();

    if (!execution.useAllTools && execution.onlyTools.length === 0) {
      setError('Select at least one tool, or enable "Use all available tools"');
      return false;
    }

    const maxParallel = validateIntegerRange('Max parallel workers', execution.maxParallel, 0, 8);
    if (maxParallel === null) {
      return false;
    }

    const retries = validateIntegerRange('Retries', execution.retries, 0, 5);
    if (retries === null) {
      return false;
    }

    const backoff = validateIntegerRange('Backoff seconds', execution.backoff, 1, 60);
    if (backoff === null) {
      return false;
    }

    const timeout = validateIntegerRange('Timeout seconds', execution.timeout, 30, 7200);
    if (timeout === null) {
      return false;
    }

    const maxSteps = validateIntegerRange('Max steps', execution.maxSteps, 0, 1000);
    if (maxSteps === null) {
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const execution = getEffectiveExecutionSettings();

      const payload = {
        scan_name: formData.scanName.trim(),
        target: formData.target.trim(),
        scan_profile: formData.scanProfile,
        planner_engine: formData.plannerEngine,
        orchestration_mode: execution.orchestrationMode,
        max_parallel: execution.orchestrationMode === 'sequential' ? 1 : Number(execution.maxParallel),
        retries: Number(execution.retries),
        backoff: Number(execution.backoff),
        timeout: Number(execution.timeout),
        max_steps: Number(execution.maxSteps),
        only_tools: execution.useAllTools ? [] : execution.onlyTools,
        authorization_ack: formData.authorizationAck,
      };

      const scanJob = await createScan(payload);

      setCreatedScan(scanJob);
      setScanStarted(true);

      // Redirect to active scans after a delay
      setTimeout(() => {
        navigate('/scans');
      }, 1500);

    } catch (err) {
      setError(err.message || 'Failed to start scan. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (scanStarted) {
    return (
      <div className="container mx-auto p-6">
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center p-10">
            <div className="bg-green-100 p-4 rounded-full mb-4">
              <Shield className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Scan Started Successfully!</h2>
            <p className="text-gray-600 mb-6">
              Your security scan for <span className="font-semibold">{formData.target}</span> has been initiated.
              {createdScan?.id ? (
                <span> Job ID: <span className="font-semibold">#{createdScan.id}</span>.</span>
              ) : null}
              You will be redirected to the Active Scans page shortly.
            </p>
            <Button onClick={() => navigate('/scans')} className="mt-4">
              View Scans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">New Security Scan</h1>
      </div>
      
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Configure Scan Parameters</CardTitle>
          <CardDescription>
            This form is aligned to backend scan creation fields and sends only supported options.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="target">Target & Profile</TabsTrigger>
                <TabsTrigger value="execution" disabled={formData.scanProfile === 'custom' && !formData.enableCustomTuning}>
                  Execution Options
                </TabsTrigger>
              </TabsList>

              <TabsContent value="target" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <LabelWithHelp
                    htmlFor="scanName"
                    label="Scan Name"
                    helpText="Scan name like you want to view in dashboard."
                  />
                  <Input
                    id="scanName"
                    name="scanName"
                    placeholder="My Security Scan"
                    value={formData.scanName}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <LabelWithHelp
                    htmlFor="target"
                    label="Target URL or IP Address"
                    helpText="Enter the exact domain, URL, IP, or CIDR target to scan."
                  />
                  <Input
                    id="target"
                    name="target"
                    placeholder="example.com or https://example.com or 192.168.1.1"
                    value={formData.target}
                    onChange={handleChange}
                    required
                  />
                  <p className="text-sm text-gray-500">
                    Backend accepts domain, application URL, IP, and CIDR targets.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>Scan Profile</Label>
                    <FieldHelp text="Choose a preset. Standard and Quick auto-fill execution settings. For Custom, enable manual tuning with the toggle below." />
                  </div>
                  <RadioGroup
                    value={formData.scanProfile}
                    onValueChange={handleScanProfileChange}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="standard" id="profile-standard" />
                      <Label htmlFor="profile-standard" className="font-normal">Standard (balanced defaults)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quick" id="profile-quick" />
                      <Label htmlFor="profile-quick" className="font-normal">Quick (sequential, reduced max steps)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="custom" id="profile-custom" />
                      <Label htmlFor="profile-custom" className="font-normal">Custom (manual execution tuning)</Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.scanProfile === 'custom' ? (
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="enableCustomTuning"
                        checked={formData.enableCustomTuning}
                        onCheckedChange={handleCustomTuningToggle}
                      />
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="enableCustomTuning" className="font-normal">Enable manual custom tuning</Label>
                        <FieldHelp text="Turn this on to unlock execution fields and choose custom values. Turn off to use safe defaults." />
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">
                      {formData.enableCustomTuning
                        ? 'Custom tuning enabled. Open Execution Options to adjust values.'
                        : 'Custom profile selected with safe defaults. Enable the toggle to tune manually.'}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <LabelWithHelp
                    htmlFor="plannerEngine"
                    label="Planner Engine"
                    helpText="Rules uses deterministic planning. AI uses model-guided planning when available."
                  />
                  <Select
                    value={formData.plannerEngine}
                    onValueChange={(value) => handleSelectChange('plannerEngine', value)}
                  >
                    <SelectTrigger id="plannerEngine">
                      <SelectValue placeholder="Select planner engine" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rules">Rules</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="execution" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <LabelWithHelp
                    htmlFor="orchestrationMode"
                    label="Orchestration Mode"
                    helpText="Auto lets backend decide. Sequential runs one step at a time. Parallel runs multiple steps together."
                  />
                  <Select
                    value={formData.orchestrationMode}
                    onValueChange={(value) => handleSelectChange('orchestrationMode', value)}
                  >
                    <SelectTrigger id="orchestrationMode">
                      <SelectValue placeholder="Select orchestration mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="sequential">Sequential</SelectItem>
                      <SelectItem value="parallel">Parallel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <LabelWithHelp
                      htmlFor="maxParallel"
                      label="Max Parallel Workers (0-8)"
                      helpText="Controls backend max_parallel. Use 0 for auto behavior, or set a limit up to 8."
                    />
                    <Input
                      id="maxParallel"
                      name="maxParallel"
                      type="number"
                      min="0"
                      max="8"
                      value={formData.maxParallel}
                      onChange={handleChange}
                      disabled={formData.orchestrationMode === 'sequential'}
                    />
                  </div>

                  <div className="space-y-2">
                    <LabelWithHelp
                      htmlFor="retries"
                      label="Retries (0-5)"
                      helpText="How many retry attempts are allowed per failed step."
                    />
                    <Input
                      id="retries"
                      name="retries"
                      type="number"
                      min="0"
                      max="5"
                      value={formData.retries}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <LabelWithHelp
                      htmlFor="backoff"
                      label="Backoff Seconds (1-60)"
                      helpText="Delay between retries after a failed step."
                    />
                    <Input
                      id="backoff"
                      name="backoff"
                      type="number"
                      min="1"
                      max="60"
                      value={formData.backoff}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <LabelWithHelp
                      htmlFor="timeout"
                      label="Timeout Seconds (30-7200)"
                      helpText="Maximum execution time per step before timeout."
                    />
                    <Input
                      id="timeout"
                      name="timeout"
                      type="number"
                      min="30"
                      max="7200"
                      value={formData.timeout}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <LabelWithHelp
                      htmlFor="maxSteps"
                      label="Max Steps (0-1000)"
                      helpText="0 means no cap. Set a number to limit how many planner steps run."
                    />
                    <Input
                      id="maxSteps"
                      name="maxSteps"
                      type="number"
                      min="0"
                      max="1000"
                      value={formData.maxSteps}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Label>Tool Selection (only_tools)</Label>
                    <FieldHelp position="top" text="Choose exactly which tools backend should run. If Use all is enabled, only_tools is sent empty." />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useAllTools"
                      checked={formData.useAllTools}
                      onCheckedChange={(checked) => {
                        const isChecked = normalizeCheckbox(checked);
                        setFormData((prev) => ({
                          ...prev,
                          useAllTools: isChecked,
                          onlyTools: isChecked ? [] : prev.onlyTools,
                        }));
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="useAllTools" className="font-normal">Use all available tools (recommended)</Label>
                      <FieldHelp position="top" text="When enabled, backend receives an empty only_tools list and selects all available tools." />
                    </div>
                  </div>

                  {!formData.useAllTools ? (
                    <>
                      <p className="text-xs text-gray-500">Selected tools: {formData.onlyTools.length}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {TOOL_OPTIONS.map((tool) => (
                          <div key={tool.value} className="flex items-start space-x-2 rounded-md border p-2">
                            <Checkbox
                              id={`tool-${tool.value}`}
                              checked={formData.onlyTools.includes(tool.value)}
                              onCheckedChange={() => handleToolToggle(tool.value)}
                            />
                            <div>
                              <Label htmlFor={`tool-${tool.value}`} className="font-normal">{tool.label}</Label>
                              <p className="text-xs text-gray-500">{tool.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>Authorization Acknowledgement</Label>
                    <FieldHelp position="top" text="This must be checked. Backend rejects scan creation if authorization_ack is false." />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="authorizationAck"
                      checked={formData.authorizationAck}
                      onCheckedChange={(checked) => {
                        setFormData((prev) => ({
                          ...prev,
                          authorizationAck: normalizeCheckbox(checked),
                        }));
                      }}
                    />
                    <Label htmlFor="authorizationAck" className="font-normal">
                      I confirm this scan is authorized for defensive security testing.
                    </Label>
                  </div>
                </div>

                <Alert className="bg-slate-50 text-slate-700 border-slate-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    These options map directly to backend fields: scan_profile, planner_engine, orchestration_mode,
                    max_parallel, retries, backoff, timeout, max_steps, only_tools, authorization_ack.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            <CardFooter className="flex justify-between pt-6 px-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Scan...
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    Start Scan
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewScan;