/**
 * Utility to check if CORS is properly configured for an S3 bucket
 */

/**
 * Tests if the S3 bucket has proper CORS configuration by making an OPTIONS request
 * @param bucketName The S3 bucket name
 * @param region The AWS region
 * @returns A result object indicating success or failure with details
 */
export const checkS3CORS = async (
  bucketName: string,
  region: string
): Promise<{ success: boolean; message: string; details?: any }> => {
  try {
    console.log(`Testing CORS configuration for bucket: ${bucketName} in region: ${region}`);
    
    // Check if the bucket name or region is invalid
    if (!bucketName || !region) {
      return {
        success: false,
        message: 'Invalid bucket name or region',
        details: { bucketName, region }
      };
    }
    
    // Create URL to the bucket (this won't actually be used for GET, just OPTIONS)
    const bucketUrl = `https://${bucketName}.s3.${region}.amazonaws.com/test-cors-config`;
    console.log('Testing CORS with URL:', bucketUrl);
    
    // Test with direct fetch first to ensure the bucket exists
    try {
      // Simple HEAD request to check bucket exists
      const response = await fetch(bucketUrl, {
        method: 'HEAD',
        mode: 'no-cors' // This allows us to at least check if the bucket exists
      });
      
      console.log('Bucket existence check response:', response.status, response.statusText);
    } catch (error) {
      console.error('Error checking bucket existence:', error);
    }
    
    // Now try the actual CORS preflight request
    try {
      // Test with a preflight OPTIONS request
      const response = await fetch(bucketUrl, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'Content-Type,X-Amz-Date,Authorization'
        },
        mode: 'cors'
      });
      
      // Check if we got appropriate CORS headers back
      const corsHeaders = {
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
        'access-control-allow-headers': response.headers.get('access-control-allow-headers')
      };
      
      console.log('CORS response headers:', corsHeaders);
      
      // Check if we have the necessary headers
      if (corsHeaders['access-control-allow-origin']) {
        // Test if our origin is allowed
        const allowedOrigin = corsHeaders['access-control-allow-origin'];
        const isOriginAllowed = allowedOrigin === '*' || allowedOrigin === window.location.origin;
        
        if (!isOriginAllowed) {
          return {
            success: false,
            message: 'Your origin is not allowed in the bucket CORS configuration',
            details: corsHeaders
          };
        }
        
        // Check if PUT method is allowed
        const allowedMethods = corsHeaders['access-control-allow-methods'] || '';
        if (!allowedMethods.includes('PUT')) {
          return {
            success: false,
            message: 'PUT method is not allowed in the bucket CORS configuration',
            details: corsHeaders
          };
        }
        
        return {
          success: true,
          message: 'CORS is correctly configured for this bucket',
          details: corsHeaders
        };
      } else {
        return {
          success: false,
          message: 'CORS headers missing from response. CORS is not configured for this bucket.',
          details: corsHeaders
        };
      }
    } catch (corsError) {
      console.error('CORS preflight request failed:', corsError);
      
      // Provide a more specific message for CORS errors
      return {
        success: false,
        message: 'CORS check failed. Your bucket likely needs CORS configuration.',
        details: {
          error: corsError.message,
          bucketUrl
        }
      };
    }
  } catch (error) {
    console.error('Error checking S3 CORS:', error);
    return {
      success: false,
      message: `Error testing CORS: ${error.message}`,
      details: error
    };
  }
};

/**
 * Gets the S3 bucket URL from the bucket name and region
 * @param bucketName The S3 bucket name
 * @param region The AWS region
 * @returns The S3 bucket URL
 */
export const getS3BucketUrl = (bucketName: string, region: string): string => {
  return `https://${bucketName}.s3.${region}.amazonaws.com`;
};

/**
 * Generates the recommended CORS configuration for an S3 bucket
 * @returns The recommended CORS configuration JSON string
 */
export const getRecommendedCORSConfig = (): string => {
  const config = [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],  // For production, replace with specific origins
      "ExposeHeaders": ["ETag"]
    }
  ];
  
  return JSON.stringify(config, null, 2);
}; 