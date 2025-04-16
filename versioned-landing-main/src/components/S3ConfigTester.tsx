import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { checkS3CORS, getRecommendedCORSConfig } from '@/lib/corsChecker';
import { isS3Initialized } from '@/lib/s3Service';

/**
 * A component to test AWS S3 configuration and diagnose issues
 */
export const S3ConfigTester = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    message: string;
    details?: any;
  } | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  
  // Get environment variables for diagnostics (don't show secret key)
  const envVars = {
    region: import.meta.env.VITE_AWS_REGION,
    bucketName: import.meta.env.VITE_AWS_S3_BUCKET_NAME,
    hasAccessKey: !!import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    hasSecretKey: !!import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
    initialized: isS3Initialized()
  };

  const testCORS = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      // Test CORS configuration
      const corsResult = await checkS3CORS(
        import.meta.env.VITE_AWS_S3_BUCKET_NAME,
        import.meta.env.VITE_AWS_REGION || 'us-east-1'
      );
      
      setResult(corsResult);
    } catch (error: any) {
      setResult({
        success: false,
        message: `Test failed: ${error.message}`,
        details: error
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AWS S3 Configuration Test</CardTitle>
        <CardDescription>
          Test your AWS S3 configuration to diagnose upload issues
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Configuration Status */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Current Configuration</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>AWS Region:</div>
              <div className={!envVars.region ? "text-red-500" : ""}>
                {envVars.region || "Not set"}
              </div>
              
              <div>S3 Bucket Name:</div>
              <div className={!envVars.bucketName ? "text-red-500" : ""}>
                {envVars.bucketName || "Not set"}
              </div>
              
              <div>Access Key ID:</div>
              <div className={!envVars.hasAccessKey ? "text-red-500" : ""}>
                {envVars.hasAccessKey ? "Configured" : "Not configured"}
              </div>
              
              <div>Secret Access Key:</div>
              <div className={!envVars.hasSecretKey ? "text-red-500" : ""}>
                {envVars.hasSecretKey ? "Configured" : "Not configured"}
              </div>
              
              <div>S3 Client Status:</div>
              <div className={!envVars.initialized ? "text-red-500" : "text-green-500"}>
                {envVars.initialized ? "Initialized" : "Not initialized"}
              </div>
            </div>
          </div>
          
          {/* Test Results */}
          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <AlertTitle>{result.success ? "Test Passed" : "Test Failed"}</AlertTitle>
              <AlertDescription>
                {result.message}
                {!result.success && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm"
                    onClick={() => setShowConfig(true)}
                  >
                    Show recommended configuration
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          
          {/* CORS Configuration */}
          {showConfig && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium">Recommended CORS Configuration</h3>
              <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-md overflow-x-auto">
                <pre className="text-xs">{getRecommendedCORSConfig()}</pre>
              </div>
              <p className="text-xs">
                Add this configuration to your S3 bucket's CORS settings in the AWS S3 console.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(false)}
              >
                Hide
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={testCORS}
          disabled={testing || !envVars.bucketName || !envVars.region}
        >
          {testing ? "Testing..." : "Test CORS Configuration"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default S3ConfigTester; 