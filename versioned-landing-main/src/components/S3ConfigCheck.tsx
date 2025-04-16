import { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Globe } from 'lucide-react';
import { isS3Initialized } from '@/lib/s3Service';
import { checkS3CORS, getRecommendedCORSConfig } from '@/lib/corsChecker';

const S3ConfigCheck = () => {
  const [configError, setConfigError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [corsCheckResult, setCorsCheckResult] = useState<{ success: boolean; message: string } | null>(null);
  const [checkingCors, setCheckingCors] = useState(false);

  const checkS3Config = async () => {
    setChecking(true);
    try {
      // Check if AWS config variables are present
      const accessKeyId = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
      const secretAccessKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
      const region = import.meta.env.VITE_AWS_REGION;
      const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME;

      if (!accessKeyId) {
        setConfigError('AWS Access Key ID is missing in environment variables');
        return;
      }

      if (!secretAccessKey) {
        setConfigError('AWS Secret Access Key is missing in environment variables');
        return;
      }

      if (!region) {
        setConfigError('AWS Region is missing in environment variables');
        return;
      }

      if (!bucketName) {
        setConfigError('AWS S3 Bucket Name is missing in environment variables');
        return;
      }

      // Check if S3 was successfully initialized
      if (!isS3Initialized()) {
        setConfigError('AWS S3 failed to initialize. Check the browser console for specific errors.');
        return;
      }

      // If all config variables are present and initialization was successful
      setConfigError(null);
    } catch (error: any) {
      setConfigError(`Error checking S3 configuration: ${error.message}`);
    } finally {
      setChecking(false);
    }
  };

  const handleCheckCORS = async () => {
    const bucketName = import.meta.env.VITE_AWS_S3_BUCKET_NAME;
    const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
    
    if (!bucketName || !region) {
      setCorsCheckResult({
        success: false,
        message: 'Bucket name or region is missing in environment variables'
      });
      return;
    }
    
    setCheckingCors(true);
    try {
      const result = await checkS3CORS(bucketName, region);
      setCorsCheckResult(result);
      
      // If CORS is not configured, update the config error
      if (!result.success) {
        setConfigError('CORS configuration issue detected. This will prevent file uploads.');
      }
    } catch (error: any) {
      setCorsCheckResult({
        success: false,
        message: `Error checking CORS: ${error.message}`
      });
    } finally {
      setCheckingCors(false);
    }
  };

  useEffect(() => {
    checkS3Config();
  }, []);

  if (!configError) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>S3 Configuration Error</AlertTitle>
      <AlertDescription>
        <p className="mb-2">{configError}</p>
        <p className="mb-2">
          Please check your <code>.env</code> file and ensure all AWS S3 configuration variables are set correctly.
          Try opening the browser console (F12) to see detailed error messages.
        </p>
        {configError.includes('CORS') && (
          <p className="mb-2">
            <strong>CORS Issue Detected:</strong> Make sure your S3 bucket has proper CORS settings:
            <pre className="mt-2 p-2 bg-gray-800 rounded text-xs overflow-auto">
              {`[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]`}
            </pre>
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkS3Config} 
            disabled={checking}
          >
            {checking ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Check Config
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCheckCORS}
            disabled={checkingCors}
          >
            {checkingCors ? <Globe className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
            Test CORS
          </Button>
        </div>
        
        {corsCheckResult && (
          <div className={`mt-3 p-3 rounded text-sm ${corsCheckResult.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <p className="font-medium">{corsCheckResult.success ? '✅ CORS Test Passed' : '❌ CORS Test Failed'}</p>
            <p>{corsCheckResult.message}</p>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};

export default S3ConfigCheck; 