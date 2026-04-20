import { useState } from 'react';
import { Button } from './ui/button';
import { Download, Loader2 } from 'lucide-react';
import { downloadFullReport } from '../services/reportService';
import { toast } from './ui/use-toast';

/**
 * SecureFileDownload component for handling secure file downloads with authentication
 * @param {Object} props - Component props
 * @param {Object} props.report - The report object containing id and report_name
 * @param {string} props.buttonText - Optional custom button text
 * @param {string} props.variant - Button variant (default: 'outline')
 * @param {string} props.size - Button size (default: 'default')
 */
const SecureFileDownload = ({ 
  report, 
  buttonText = 'Download Full Report', 
  variant = 'outline',
  size = 'default'
}) => {
  const [loading, setLoading] = useState(false);

  // Handle download with error handling and loading state
  const handleDownload = async () => {
    if (!report || !report.id) {
      toast({
        title: 'Error',
        description: 'No report selected for download',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await downloadFullReport(report.id, report.report_name);
      toast({
        title: 'Success',
        description: 'Report downloaded successfully',
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={loading || !report}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          {buttonText}
        </>
      )}
    </Button>
  );
};

export default SecureFileDownload;