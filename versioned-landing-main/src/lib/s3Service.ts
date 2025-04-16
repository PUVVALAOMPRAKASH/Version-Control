// Browser compatibility polyfills for AWS SDK
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  // Global object polyfill
  window.global = window;
  
  // Process polyfill
  window.process = window.process || {} as any;
  window.process.env = window.process.env || {};
  
  // Buffer polyfill (AWS SDK uses this)
  window.Buffer = window.Buffer || Buffer;
}

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListBucketsCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentUser } from './authService';

// Create a safe initialization function that won't break the app on error
const initializeS3 = () => {
  try {
    // Log initial environment variables (without exposing secret key)
    console.log('S3 Configuration:', {
      accessKeyIdPresent: !!import.meta.env.VITE_AWS_ACCESS_KEY_ID,
      regionPresent: !!import.meta.env.VITE_AWS_REGION,
      bucketNamePresent: !!import.meta.env.VITE_AWS_S3_BUCKET_NAME,
      bucketName: import.meta.env.VITE_AWS_S3_BUCKET_NAME,
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1'
    });

    // Initialize S3 client with AWS SDK v3
    const s3Client = new S3Client({
      region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
      },
    });
    
    console.log('AWS SDK v3 client configured successfully');

    const BUCKET_NAME = import.meta.env.VITE_AWS_S3_BUCKET_NAME;

    // Test connection to S3 (don't wait for this to complete)
    s3Client.send(new ListBucketsCommand({}))
      .then(data => {
        console.log('S3 connection successful, available buckets:', data.Buckets?.map(b => b.Name));
      })
      .catch(err => {
        console.error('S3 connection test failed:', err);
      });

    return { s3Client, BUCKET_NAME, initialized: true };
  } catch (error) {
    console.error('Error initializing AWS SDK:', error);
    // Return a dummy implementation that won't break the app
    return { 
      s3Client: null, 
      BUCKET_NAME: '', 
      initialized: false 
    };
  }
};

// Initialize S3 safely
const { s3Client, BUCKET_NAME, initialized } = initializeS3();

/**
 * Uploads a file to S3
 * @param repoId Repository ID
 * @param fileName File name
 * @param fileContent File content (string, Blob, or ArrayBuffer)
 * @param contentType Content type of the file (e.g., 'text/plain')
 * @returns Promise with upload result
 */
export const uploadFileToS3 = async (
  repoId: string,
  fileName: string,
  fileContent: string | Blob | ArrayBuffer,
  contentType: string = 'text/plain'
): Promise<{ success: boolean; url?: string; error?: string; details?: any }> => {
  try {
    console.log('Starting file upload:', { repoId, fileName, contentType });
    
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      console.error('S3 client not initialized');
      return { 
        success: false, 
        error: 'AWS S3 is not properly configured', 
        details: { 
          bucketName: BUCKET_NAME || 'not configured',
          region: import.meta.env.VITE_AWS_REGION || 'not configured', 
          accessKeyPresent: !!import.meta.env.VITE_AWS_ACCESS_KEY_ID
        }
      };
    }

    const currentUser = getCurrentUser();
    if (!currentUser) {
      console.error('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Validate the file content
    if (!fileContent) {
      console.error('File content is empty');
      return { success: false, error: 'File content cannot be empty' };
    }

    // Detect content type if not provided
    let finalContentType = contentType;
    if (!contentType || contentType === 'text/plain') {
      if (isTextFile(fileName)) {
        finalContentType = 'text/plain';
      } else {
        finalContentType = 'application/octet-stream';
      }
    }
    console.log(`Using content type: ${finalContentType}`);

    // Convert content to appropriate format
    let content: Uint8Array;
    try {
      if (typeof fileContent === 'string') {
        console.log('Converting string content to Uint8Array');
        content = new TextEncoder().encode(fileContent);
      } else if (fileContent instanceof Blob) {
        console.log('Converting Blob to Uint8Array');
        // Convert Blob to ArrayBuffer, then to Uint8Array
        const arrayBuffer = await fileContent.arrayBuffer();
        content = new Uint8Array(arrayBuffer);
      } else if (fileContent instanceof ArrayBuffer) {
        console.log('Converting ArrayBuffer to Uint8Array');
        // ArrayBuffer to Uint8Array
        content = new Uint8Array(fileContent);
      } else {
        // Handle the case where fileContent might be something else
        console.log('Unknown content type, attempting to convert', typeof fileContent);
        // Try to convert it to a string first, then to a Uint8Array
        const strContent = String(fileContent);
        content = new TextEncoder().encode(strContent);
      }
      console.log('Content converted successfully, length:', content.length);
    } catch (conversionError) {
      console.error('Error converting content:', conversionError);
      return { 
        success: false, 
        error: `Failed to process file content: ${conversionError.message}`,
        details: { 
          contentType: typeof fileContent, 
          fileName,
          errorDetails: conversionError 
        }
      };
    }

    // Create a key (path) for the file
    const key = `repositories/${repoId}/files/${fileName}`;
    console.log('S3 key:', key);

    // Set S3 upload parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: finalContentType,
      Metadata: {
        'user-id': currentUser.uid,
        'uploaded-at': new Date().toISOString(),
        'original-filename': fileName
      },
    };

    console.log('Uploading to S3 with params:', {
      bucket: params.Bucket,
      key: params.Key,
      contentType: params.ContentType,
      contentLength: content.length,
    });

    // Upload to S3
    try {
      const result = await s3Client.send(new PutObjectCommand(params));
      console.log('File uploaded successfully to S3:', result);
    } catch (uploadError: any) {
      console.error('S3 upload error:', uploadError);
      
      // Check for CORS issues
      if (uploadError.message?.includes('CORS') || 
          uploadError.name === 'NetworkError' || 
          uploadError.code === 'NetworkingError') {
        return { 
          success: false, 
          error: 'CORS policy error. Your S3 bucket may need CORS configuration.',
          details: {
            message: uploadError.message,
            code: uploadError.code,
            name: uploadError.name,
            bucketUrl: `https://${BUCKET_NAME}.s3.${import.meta.env.VITE_AWS_REGION || 'us-east-1'}.amazonaws.com`
          }
        };
      }
      
      // Check for credentials issues
      if (uploadError.name === 'CredentialsProviderError' || 
          uploadError.message?.includes('credential') || 
          uploadError.code === 'InvalidAccessKeyId' || 
          uploadError.code === 'SignatureDoesNotMatch') {
        return {
          success: false,
          error: 'Invalid AWS credentials. Please check your AWS access keys.',
          details: {
            message: uploadError.message,
            code: uploadError.code,
            name: uploadError.name
          }
        };
      }
      
      // Check for bucket not found
      if (uploadError.code === 'NoSuchBucket') {
        return {
          success: false,
          error: `Bucket '${BUCKET_NAME}' not found. Please check your bucket name and region.`,
          details: {
            message: uploadError.message,
            code: uploadError.code,
            bucketName: BUCKET_NAME,
            region: import.meta.env.VITE_AWS_REGION || 'us-east-1'
          }
        };
      }
      
      // Rethrow for general catch
      throw uploadError;
    }

    // Generate a URL for the uploaded file
    console.log('Generating signed URL for uploaded file');
    let urlResult;
    try {
      urlResult = await getFileSignedUrl(repoId, fileName);
      if (!urlResult.success) {
        console.error('Failed to generate signed URL:', urlResult.error);
      } else {
        console.log('Signed URL generated successfully');
      }
    } catch (urlError) {
      console.error('Error generating signed URL:', urlError);
      // Continue anyway, we'll return success even without a URL
      urlResult = { success: false, error: 'Failed to generate download URL' };
    }

    return {
      success: true,
      url: urlResult?.url,
    };
  } catch (error: any) {
    console.error('Error uploading file to S3:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file to S3',
      details: {
        code: error.code,
        name: error.name,
        stack: error.stack
      }
    };
  }
};

/**
 * Downloads a file from S3
 * @param repoId Repository ID
 * @param fileName File name
 * @returns Promise with file content and metadata
 */
export const downloadFileFromS3 = async (
  repoId: string,
  fileName: string
): Promise<{ success: boolean; content?: string | ArrayBuffer; metadata?: any; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }

    // Create a key (path) for the file
    const key = `repositories/${repoId}/files/${fileName}`;
    
    console.log(`Downloading file from S3: ${key}`);

    // Set S3 get parameters with cache busting
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      // Add a ResponseCacheControl header to prevent caching
      ResponseCacheControl: 'no-cache, no-store, must-revalidate',
    };

    // Get object from S3
    const data = await s3Client.send(new GetObjectCommand(params));
    
    console.log(`File download successful: ${key}`, {
      contentType: data.ContentType,
      metadataKeys: data.Metadata ? Object.keys(data.Metadata) : 'none',
      lastModified: data.LastModified
    });
    
    // Get the response body
    if (!data.Body) {
      throw new Error('File content is empty');
    }

    // Convert ReadableStream to ArrayBuffer
    const bodyContents = await streamToArrayBuffer(data.Body as ReadableStream);

    // Convert content based on file type
    let content: string | ArrayBuffer;
    if (data.ContentType?.includes('text') || isTextFile(fileName)) {
      // For text files, convert to string
      content = new TextDecoder().decode(new Uint8Array(bodyContents));
      console.log(`Decoded text content, length: ${(content as string).length}`);
    } else {
      // For binary files, return as ArrayBuffer
      content = bodyContents;
      console.log(`Decoded binary content, length: ${bodyContents.byteLength}`);
    }

    return {
      success: true,
      content,
      metadata: data.Metadata,
    };
  } catch (error: any) {
    console.error('Error downloading file from S3:', error);
    return {
      success: false,
      error: error.message || 'Failed to download file from S3',
    };
  }
};

// Helper to convert ReadableStream to ArrayBuffer
async function streamToArrayBuffer(stream: ReadableStream): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  
  // Concatenate all chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result.buffer;
}

/**
 * Gets a signed URL for downloading a file
 * @param repoId Repository ID
 * @param fileName File name
 * @param expiresIn Expiration time in seconds (default: 15 minutes)
 * @returns Promise with signed URL
 */
export const getFileSignedUrl = async (
  repoId: string,
  fileName: string,
  expiresIn: number = 900 // 15 minutes
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }

    // Create a key (path) for the file
    const key = `repositories/${repoId}/files/${fileName}`;

    // Set parameters for getting a signed URL
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    // Generate signed URL
    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3Client, command, { expiresIn });

    return {
      success: true,
      url,
    };
  } catch (error: any) {
    console.error('Error generating signed URL:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate signed URL',
    };
  }
};

/**
 * Lists all files in a repository
 * @param repoId Repository ID
 * @returns Promise with list of files
 */
export const listRepositoryFiles = async (
  repoId: string
): Promise<{ success: boolean; files?: any[]; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }

    // Set prefix for listing objects (all files in the repository)
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: `repositories/${repoId}/files/`,
      Delimiter: '/', // Use delimiter to only list files, not "subfolders"
    };

    // List objects from S3
    const data = await s3Client.send(new ListObjectsV2Command(params));

    // Process the files
    if (!data.Contents || data.Contents.length === 0) {
      return { success: true, files: [] };
    }

    // Get metadata and URLs for each file
    const filesPromises = data.Contents.map(async (item) => {
      if (!item.Key) return null;

      const fileName = item.Key.split('/').pop() || '';
      const headParams = {
        Bucket: BUCKET_NAME,
        Key: item.Key,
      };
      
      const metadata = await s3Client.send(new HeadObjectCommand(headParams));

      // Generate a signed URL
      const getCommand = new GetObjectCommand(headParams);
      const url = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

      return {
        name: fileName,
        path: item.Key,
        size: item.Size || 0,
        contentType: metadata.ContentType || 'application/octet-stream',
        createdAt: new Date(metadata.LastModified || Date.now()),
        downloadUrl: url,
      };
    });

    const files = (await Promise.all(filesPromises)).filter(Boolean);

    return {
      success: true,
      files,
    };
  } catch (error: any) {
    console.error('Error listing repository files:', error);
    return {
      success: false,
      error: error.message || 'Failed to list repository files',
    };
  }
};

/**
 * Deletes a file from S3
 * @param repoId Repository ID
 * @param fileName File name
 * @returns Promise with delete result
 */
export const deleteFileFromS3 = async (
  repoId: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }

    // Create a key (path) for the file
    const key = `repositories/${repoId}/files/${fileName}`;

    // Set S3 delete parameters
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    // Delete object from S3
    await s3Client.send(new DeleteObjectCommand(params));

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error deleting file from S3:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete file from S3',
    };
  }
};

/**
 * Checks if a file is likely to be a text file based on its extension
 * @param fileName File name
 * @returns Boolean indicating if it's likely a text file
 */
export const isTextFile = (fileName: string): boolean => {
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.html', '.css', 
    '.scss', '.xml', '.yaml', '.yml', '.csv', '.log', '.sh', '.bat', '.ps1',
    '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rs',
    '.swift', '.kt', '.sql', '.gitignore', '.env', '.config', '.toml'
  ];
  
  const lowerFileName = fileName.toLowerCase();
  return textExtensions.some(ext => lowerFileName.endsWith(ext));
};

/**
 * Saves a commit version of a file
 * @param repoId Repository ID
 * @param fileName File name
 * @param fileContent File content
 * @param commitMessage Commit message
 * @param previousVersionTimestamp Timestamp of previous version
 * @returns Promise with commit result
 */
export const commitFileVersion = async (
  repoId: string,
  fileName: string,
  fileContent: string,
  commitMessage: string,
  previousVersionTimestamp?: string
): Promise<{ success: boolean; timestamp?: string; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const timestamp = new Date().toISOString();
    
    // 1. First save the current file content to the regular file path
    console.log(`Uploading file content to regular path for ${fileName}`, {
      repoId, 
      fileContentLength: fileContent.length,
      timestamp
    });
    
    // Directly use PutObjectCommand for the main file path to ensure it's updated
    const fileKey = `repositories/${repoId}/files/${fileName}`;
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: new TextEncoder().encode(fileContent),
        ContentType: 'text/plain',
        Metadata: {
          'user-id': currentUser.uid,
          'user-email': currentUser.email || '',
          'uploaded-at': timestamp,
          'original-filename': fileName
        },
      }));
      console.log(`Successfully uploaded file to main path: ${fileKey}`);
    } catch (uploadError) {
      console.error('Error uploading to main path:', uploadError);
      throw new Error(`Failed to update main file: ${uploadError.message}`);
    }

    // 2. Save a copy in the history folder
    console.log(`Saving file to history path for ${fileName}`);
    const historyKey = `repositories/${repoId}/history/${fileName}/${timestamp}.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: historyKey,
      Body: new TextEncoder().encode(fileContent),
      ContentType: 'text/plain',
      Metadata: {
        'user-id': currentUser.uid,
        'user-email': currentUser.email || '',
        'commit-message': commitMessage,
        'timestamp': timestamp,
        'previous-version': previousVersionTimestamp || '',
      },
    }));
    console.log(`Successfully saved file to history path: ${historyKey}`);

    // 3. Save commit metadata
    console.log(`Saving commit metadata for ${fileName}`);
    const commitKey = `repositories/${repoId}/commits/${fileName}/${timestamp}.json`;
    const commitData = {
      message: commitMessage,
      timestamp,
      author: currentUser.email || currentUser.uid,
      previousVersion: previousVersionTimestamp,
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: commitKey,
      Body: new TextEncoder().encode(JSON.stringify(commitData)),
      ContentType: 'application/json',
    }));
    console.log(`Successfully saved commit metadata: ${commitKey}`);

    return {
      success: true,
      timestamp,
    };
  } catch (error: any) {
    console.error('Error committing file version:', error);
    return {
      success: false,
      error: error.message || 'Failed to commit file version',
    };
  }
};

/**
 * Gets the commit history for a file
 * @param repoId Repository ID
 * @param fileName File name
 * @returns Promise with list of commits
 */
export const getFileCommitHistory = async (
  repoId: string,
  fileName: string
): Promise<{ success: boolean; commits?: any[]; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    // Get all commit metadata files for this file
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: `repositories/${repoId}/commits/${fileName}/`,
    };

    const data = await s3Client.send(new ListObjectsV2Command(params));

    if (!data.Contents || data.Contents.length === 0) {
      return { success: true, commits: [] };
    }

    // Get each commit's metadata
    const commitsPromises = data.Contents.map(async (item) => {
      if (!item.Key) return null;

      const getParams = {
        Bucket: BUCKET_NAME,
        Key: item.Key,
      };
      
      const result = await s3Client.send(new GetObjectCommand(getParams));

      if (!result.Body) return null;

      // Convert body to text
      const bodyContents = await streamToArrayBuffer(result.Body as ReadableStream);
      const bodyText = new TextDecoder().decode(new Uint8Array(bodyContents));

      try {
        const commitData = JSON.parse(bodyText);
        return {
          ...commitData,
          id: item.Key.split('/').pop()?.replace('.json', '') || '',
        };
      } catch (e) {
        console.error('Error parsing commit data:', e);
        return null;
      }
    });

    const commits = (await Promise.all(commitsPromises))
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort by date desc

    return {
      success: true,
      commits,
    };
  } catch (error: any) {
    console.error('Error getting file commit history:', error);
    return {
      success: false,
      error: error.message || 'Failed to get file commit history',
    };
  }
};

/**
 * Gets a specific version of a file
 * @param repoId Repository ID
 * @param fileName File name
 * @param timestamp Version timestamp
 * @param fromPending Whether to get from pending folder instead of history
 * @returns Promise with file content
 */
export const getFileVersion = async (
  repoId: string,
  fileName: string,
  timestamp: string,
  fromPending: boolean = false
): Promise<{ success: boolean; content?: string; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const folder = fromPending ? 'pending' : 'history';
    const fileKey = `repositories/${repoId}/${folder}/${fileName}/${timestamp}.txt`;
    
    console.log(`Getting file version from ${folder}: ${fileKey}`);
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: fileKey,
    };
    
    try {
      const result = await s3Client.send(new GetObjectCommand(params));
      
      if (!result.Body) {
        return { success: false, error: 'File content not found' };
      }
      
      // Convert body to text
      const bodyContents = await streamToArrayBuffer(result.Body as ReadableStream);
      const content = new TextDecoder().decode(new Uint8Array(bodyContents));
      
      return { success: true, content };
    } catch (error: any) {
      console.error(`Error getting file version from ${folder}:`, error);
      
      if (error.name === 'NoSuchKey') {
        return { success: false, error: 'Version not found' };
      }
      
      return { success: false, error: error.message || `Failed to get file version from ${folder}` };
    }
  } catch (error: any) {
    console.error('Error in getFileVersion:', error);
    return { success: false, error: error.message || 'Failed to get file version' };
  }
};

/**
 * Uploads a file and creates a commit in one operation
 * @param repoId Repository ID
 * @param fileName File name
 * @param fileContent File content
 * @param commitMessage Commit message
 * @param user Current user (optional, will get from authService if not provided)
 * @returns Promise with upload and commit result
 */
export const uploadFileWithCommit = async (
  repoId: string,
  fileName: string,
  fileContent: string | ArrayBuffer | Blob,
  commitMessage: string,
  user?: any
): Promise<{ success: boolean; timestamp?: string; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = user || getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const timestamp = new Date().toISOString();
    
    // 1. Upload the file content to the regular file path
    const contentType = 'text/plain';
    const uploadResult = await uploadFileToS3(
      repoId,
      fileName,
      fileContent,
      contentType
    );

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload file content');
    }

    // 2. Save a copy in the history folder
    let fileContentString: string;
    if (typeof fileContent === 'string') {
      fileContentString = fileContent;
    } else if (fileContent instanceof ArrayBuffer) {
      fileContentString = new TextDecoder().decode(new Uint8Array(fileContent));
    } else if (fileContent instanceof Blob) {
      const arrayBuffer = await fileContent.arrayBuffer();
      fileContentString = new TextDecoder().decode(new Uint8Array(arrayBuffer));
    } else {
      throw new Error('Unsupported file content type');
    }
    
    const historyKey = `repositories/${repoId}/history/${fileName}/${timestamp}.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: historyKey,
      Body: new TextEncoder().encode(fileContentString),
      ContentType: 'text/plain',
      Metadata: {
        'user-id': currentUser.uid,
        'user-email': currentUser.email || '',
        'commit-message': commitMessage,
        'timestamp': timestamp,
      },
    }));

    // 3. Save commit metadata
    const commitKey = `repositories/${repoId}/commits/${fileName}/${timestamp}.json`;
    const commitData = {
      message: commitMessage,
      timestamp,
      author: currentUser.email || currentUser.uid,
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: commitKey,
      Body: new TextEncoder().encode(JSON.stringify(commitData)),
      ContentType: 'application/json',
    }));

    return {
      success: true,
      timestamp,
    };
  } catch (error: any) {
    console.error('Error uploading file with commit:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload file with commit',
    };
  }
};

// Add the initialized status export
export const isS3Initialized = (): boolean => {
  return initialized;
};

/**
 * Gets file content from S3 (alias for downloadFileFromS3 for backward compatibility)
 * @param repoId Repository ID
 * @param fileName File name
 * @returns Promise with file content and metadata
 */
export const getFileContent = async (
  repoId: string,
  fileName: string
): Promise<{ success: boolean; content?: string | ArrayBuffer; metadata?: Record<string, string>; error?: string }> => {
  return downloadFileFromS3(repoId, fileName);
};

/**
 * Copies all files from source repository to target repository
 * @param sourceRepoId Source repository ID
 * @param targetRepoId Target repository ID
 * @returns Promise with copy result
 */
export const copyRepositoryFiles = async (
  sourceRepoId: string,
  targetRepoId: string
): Promise<{ success: boolean; filesCopied?: number; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get all files from source repository
    const sourceFiles = await listRepositoryFiles(sourceRepoId);
    
    if (!sourceFiles.success || !sourceFiles.files || sourceFiles.files.length === 0) {
      return { 
        success: true, 
        filesCopied: 0, 
        error: sourceFiles.error ? `Source repository files error: ${sourceFiles.error}` : undefined
      };
    }
    
    // Copy each file to the target repository
    let successCount = 0;
    let errorFiles: string[] = [];
    
    for (const file of sourceFiles.files) {
      try {
        // Download the file content
        const downloadResult = await downloadFileFromS3(sourceRepoId, file.name);
        
        if (!downloadResult.success || !downloadResult.content) {
          errorFiles.push(`${file.name} (download failed)`);
          continue;
        }
        
        // Upload to the target repository
        const uploadResult = await uploadFileToS3(
          targetRepoId,
          file.name,
          downloadResult.content,
          file.contentType
        );
        
        if (!uploadResult.success) {
          errorFiles.push(`${file.name} (upload failed)`);
          continue;
        }
        
        successCount++;
      } catch (error) {
        console.error(`Error copying file ${file.name}:`, error);
        errorFiles.push(`${file.name} (error: ${error.message || 'unknown error'})`);
      }
    }
    
    return {
      success: true,
      filesCopied: successCount,
      error: errorFiles.length > 0 ? 
        `Failed to copy ${errorFiles.length} files: ${errorFiles.slice(0, 3).join(', ')}${errorFiles.length > 3 ? '...' : ''}` : 
        undefined
    };
  } catch (error: any) {
    console.error('Error copying repository files:', error);
    return {
      success: false,
      error: error.message || 'Failed to copy repository files',
    };
  }
};

/**
 * Gets a list of all commits for a specific file
 * @param repoId Repository ID
 * @param fileName File name
 * @returns Promise with list of commits
 */
export const listFileCommits = async (
  repoId: string,
  fileName: string
): Promise<{ success: boolean; commits?: any[]; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }

    // Set prefix for listing objects (all commits in the repository for this file)
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: `repositories/${repoId}/history/${fileName}/`,
      Delimiter: '/',
    };

    // List objects from S3
    const data = await s3Client.send(new ListObjectsV2Command(params));

    // Process the commits
    if (!data.Contents || data.Contents.length === 0) {
      return { success: true, commits: [] };
    }

    // Get metadata for each commit
    const commitsPromises = data.Contents.map(async (item) => {
      if (!item.Key) return null;

      const headParams = {
        Bucket: BUCKET_NAME,
        Key: item.Key,
      };
      
      try {
        const metadata = await s3Client.send(new HeadObjectCommand(headParams));
        
        // Extract timestamp from the key (format: repositories/{repoId}/history/{fileName}/{timestamp}.txt)
        let timestamp = item.Key.split('/').pop()?.replace('.txt', '') || '';
        
        return {
          key: item.Key,
          timestamp,
          size: item.Size || 0,
          lastModified: item.LastModified || new Date(),
          commitMessage: metadata.Metadata?.['commit-message'] || '',
          userId: metadata.Metadata?.['user-id'] || '',
          userEmail: metadata.Metadata?.['user-email'] || '',
          previousVersion: metadata.Metadata?.['previous-version'] || '',
        };
      } catch (err) {
        console.error(`Error getting metadata for ${item.Key}:`, err);
        return null;
      }
    });

    const commits = (await Promise.all(commitsPromises))
      .filter(Boolean)
      // Sort by timestamp, newest first
      .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime());

    return {
      success: true,
      commits,
    };
  } catch (error: any) {
    console.error('Error listing file commits:', error);
    return {
      success: false,
      error: error.message || 'Failed to list file commits',
    };
  }
};

/**
 * Restores a specific version of a file to be the current version
 * @param repoId Repository ID
 * @param fileName File name
 * @param timestamp Version timestamp to restore
 * @param commitMessage Optional commit message for the restoration
 * @returns Promise with restore result
 */
export const restoreFileVersion = async (
  repoId: string,
  fileName: string,
  timestamp: string,
  commitMessage: string = "Restored previous version"
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    // 1. Get the content of the version to restore
    const versionResult = await getFileVersion(repoId, fileName, timestamp);
    
    if (!versionResult.success || !versionResult.content) {
      return { success: false, error: versionResult.error || 'Failed to retrieve file version' };
    }
    
    // 2. Create a new commit with the restored content
    const restoreCommitMessage = `${commitMessage} (from ${new Date(timestamp).toLocaleString()})`;
    const commitResult = await commitFileVersion(
      repoId,
      fileName,
      versionResult.content,
      restoreCommitMessage
    );
    
    if (!commitResult.success) {
      return { success: false, error: commitResult.error || 'Failed to create restore commit' };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error restoring file version:', error);
    return {
      success: false,
      error: error.message || 'Failed to restore file version',
    };
  }
};

/**
 * Creates a pending commit that requires owner approval
 * @param repoId Repository ID
 * @param fileName File name
 * @param fileContent File content
 * @param commitMessage Commit message
 * @param requesterId Requester ID
 * @param requesterEmail Requester email
 * @returns Promise with commit result
 */
export const createPendingCommit = async (
  repoId: string,
  fileName: string,
  fileContent: string,
  commitMessage: string
): Promise<{ success: boolean; requestId?: string; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const timestamp = new Date().toISOString();
    
    // 1. Save the pending change to a special pending directory
    console.log(`Saving pending commit for ${fileName}`, {
      repoId, 
      fileContentLength: fileContent.length,
      timestamp
    });
    
    // Store in pending changes folder
    const pendingKey = `repositories/${repoId}/pending/${fileName}/${timestamp}.txt`;
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: pendingKey,
      Body: new TextEncoder().encode(fileContent),
      ContentType: 'text/plain',
      Metadata: {
        'user-id': currentUser.uid,
        'user-email': currentUser.email || '',
        'commit-message': commitMessage,
        'timestamp': timestamp,
      },
    }));
    console.log(`Successfully saved file to pending path: ${pendingKey}`);

    // 2. Save commit metadata
    const commitMetadataKey = `repositories/${repoId}/pending-meta/${fileName}/${timestamp}.json`;
    const commitData = {
      message: commitMessage,
      timestamp,
      author: currentUser.email || currentUser.uid,
      authorId: currentUser.uid,
      fileName: fileName,
      status: 'pending',
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: commitMetadataKey,
      Body: new TextEncoder().encode(JSON.stringify(commitData)),
      ContentType: 'application/json',
    }));
    console.log(`Successfully saved pending commit metadata: ${commitMetadataKey}`);

    // 3. Create a notification for the repository owner
    try {
      // Get repository owner info
      const { getRepository } = await import('./repositoryService');
      const repoResult = await getRepository(repoId);
      
      if (repoResult.success && repoResult.repository) {
        const ownerId = repoResult.repository.ownerId;
        const repoName = repoResult.repository.name;
        
        if (ownerId !== currentUser.uid) {
          // Create notification
          const { createNotification } = await import('./notificationService');
          const notificationResult = await createNotification(
            ownerId,
            'commit_request',
            `${currentUser.email || 'A collaborator'} has submitted changes to ${fileName} for your approval`,
            {
              repositoryId: repoId,
              repositoryName: repoName,
              fileName,
              commitTimestamp: timestamp,
              requesterId: currentUser.uid,
              requesterEmail: currentUser.email
            }
          );
          
          console.log("Notification creation result:", notificationResult);
        }
      }
    } catch (notifyError) {
      console.error("Error creating notification (non-critical):", notifyError);
      // Continue despite notification error
    }

    return {
      success: true,
      requestId: timestamp,
    };
  } catch (error: any) {
    console.error('Error creating pending commit:', error);
    return {
      success: false,
      error: error.message || 'Failed to create pending commit',
    };
  }
};

/**
 * Gets a list of pending commit requests for a repository
 * @param repoId Repository ID
 * @returns Promise with list of pending commit requests
 */
export const getPendingCommitRequests = async (
  repoId: string
): Promise<{ success: boolean; requests?: any[]; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    // List all pending commit metadata files
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: `repositories/${repoId}/pending-meta/`,
    };

    const data = await s3Client.send(new ListObjectsV2Command(params));
    
    if (!data.Contents || data.Contents.length === 0) {
      return { success: true, requests: [] };
    }
    
    // Get each request's metadata
    const requestsPromises = data.Contents.map(async (item) => {
      if (!item.Key) return null;
      
      const getParams = {
        Bucket: BUCKET_NAME,
        Key: item.Key,
      };
      
      const result = await s3Client.send(new GetObjectCommand(getParams));
      
      if (!result.Body) return null;
      
      // Convert body to text
      const bodyContents = await streamToArrayBuffer(result.Body as ReadableStream);
      const bodyText = new TextDecoder().decode(new Uint8Array(bodyContents));
      
      try {
        const commitData = JSON.parse(bodyText);
        // Extract file path from the key
        const pathParts = item.Key!.split('/');
        const fileName = pathParts[pathParts.length - 2]; // Get the second to last part
        
        return {
          ...commitData,
          id: item.Key.split('/').pop()?.replace('.json', '') || '',
          fileName,
          path: `repositories/${repoId}/pending/${fileName}/${commitData.timestamp}.txt`,
        };
      } catch (e) {
        console.error('Error parsing commit request data:', e);
        return null;
      }
    });
    
    const requests = (await Promise.all(requestsPromises))
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort by date desc
    
    return {
      success: true,
      requests,
    };
  } catch (error: any) {
    console.error('Error getting pending commit requests:', error);
    return {
      success: false,
      error: error.message || 'Failed to get pending commit requests',
    };
  }
};

/**
 * Approve or reject a pending commit request
 * @param repoId Repository ID
 * @param requestId Request timestamp ID
 * @param fileName File name
 * @param approve Whether to approve or reject
 * @param comment Optional comment
 * @returns Promise with commit result
 */
export const processPendingCommit = async (
  repoId: string,
  requestId: string,
  fileName: string,
  approve: boolean,
  comment?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if S3 is initialized
    if (!initialized || !s3Client) {
      return { success: false, error: 'AWS S3 is not properly configured' };
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }
    
    // 1. Get the repository to verify ownership
    const { getRepository } = await import('./repositoryService');
    const repoResult = await getRepository(repoId);
    
    if (!repoResult.success || !repoResult.repository) {
      return { success: false, error: repoResult.error || 'Repository not found' };
    }
    
    // Verify the user is the repository owner
    if (repoResult.repository.ownerId !== currentUser.uid) {
      return { success: false, error: 'Only the repository owner can approve commit requests' };
    }
    
    // 2. Get the commit request metadata
    const metadataKey = `repositories/${repoId}/pending-meta/${fileName}/${requestId}.json`;
    
    try {
      const metadataResult = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: metadataKey,
      }));
      
      if (!metadataResult.Body) {
        return { success: false, error: 'Commit request metadata not found' };
      }
      
      // Convert body to text
      const bodyContents = await streamToArrayBuffer(metadataResult.Body as ReadableStream);
      const bodyText = new TextDecoder().decode(new Uint8Array(bodyContents));
      const metadata = JSON.parse(bodyText);
      
      if (approve) {
        // 3. If approved, apply the changes
        // 3.1 Get the pending file content
        const pendingKey = `repositories/${repoId}/pending/${fileName}/${requestId}.txt`;
        const fileResult = await s3Client.send(new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: pendingKey,
        }));
        
        if (!fileResult.Body) {
          return { success: false, error: 'Pending file content not found' };
        }
        
        // Get file content
        const fileContents = await streamToArrayBuffer(fileResult.Body as ReadableStream);
        const fileContent = new TextDecoder().decode(new Uint8Array(fileContents));
        
        // 3.2 Upload as a new commit
        await uploadFileWithCommit(
          repoId, 
          fileName, 
          fileContent, 
          `${metadata.message} (Approved by ${currentUser.email})`,
          currentUser
        );
        
        // 3.3 Update the request metadata
        const updatedMetadata = {
          ...metadata,
          status: 'approved',
          processedBy: currentUser.email || currentUser.uid,
          processedAt: new Date().toISOString(),
          comment: comment || '',
        };
        
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metadataKey,
          Body: new TextEncoder().encode(JSON.stringify(updatedMetadata)),
          ContentType: 'application/json',
        }));
      } else {
        // 4. If rejected, just update the metadata
        const updatedMetadata = {
          ...metadata,
          status: 'rejected',
          processedBy: currentUser.email || currentUser.uid,
          processedAt: new Date().toISOString(),
          comment: comment || '',
        };
        
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metadataKey,
          Body: new TextEncoder().encode(JSON.stringify(updatedMetadata)),
          ContentType: 'application/json',
        }));
      }
      
      // 5. Create notification for the requester
      try {
        const { createNotification } = await import('./notificationService');
        await createNotification(
          metadata.authorId,
          approve ? 'commit_request_approved' : 'commit_request_rejected',
          approve 
            ? `Your changes to ${fileName} have been approved and applied` 
            : `Your changes to ${fileName} have been rejected`,
          {
            repositoryId: repoId,
            repositoryName: repoResult.repository.name,
            fileName,
            commitTimestamp: requestId,
            comment: comment || '',
          }
        );
      } catch (notifyError) {
        console.error("Error creating notification (non-critical):", notifyError);
        // Continue despite notification error
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error accessing commit request metadata:', error);
      return { success: false, error: 'Failed to access commit request' };
    }
  } catch (error: any) {
    console.error('Error processing commit request:', error);
    return { success: false, error: error.message || 'Failed to process commit request' };
  }
}; 