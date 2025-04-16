# AWS S3 Setup Instructions

This project uses AWS S3 for file storage. Follow these steps to set up your S3 bucket and configure the application.

## Step 1: Create an AWS Account

If you don't already have an AWS account, sign up at [aws.amazon.com](https://aws.amazon.com/).

## Step 2: Create an S3 Bucket

1. Log in to the AWS Management Console
2. Navigate to the S3 service
3. Click "Create bucket"
4. Enter a globally unique bucket name (recommended: use the same value as VITE_AWS_S3_BUCKET_NAME in your .env file)
5. Choose a region (make sure to use the same region in your .env file)
6. Configure the bucket settings:
   - Block all public access: You can keep this enabled for security
   - Bucket versioning: Consider enabling this for additional file history support
   - Default encryption: Enable server-side encryption for better security
7. Click "Create bucket"

## Step 3: Configure CORS for Your Bucket

1. Select your newly created bucket
2. Go to the "Permissions" tab
3. Scroll down to the CORS section and click "Edit"
4. Add the following CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],  // For production, restrict to your domain
    "ExposeHeaders": ["ETag"]
  }
]
```

5. Save the changes

## Step 4: Create an IAM User for API Access

1. Navigate to the IAM service in AWS Console
2. Go to "Users" and click "Add user"
3. Set a username (e.g., "versioned-landing-app")
4. Select "Access key - Programmatic access" as the access type
   - This option appears on the "Set user details" page
   - Make sure to check this box to enable API access
5. Click "Next: Permissions"
6. Choose "Attach existing policies directly"
7. Search for and select "AmazonS3FullAccess" (for a production environment, create a more restricted custom policy)
8. Click through the remaining steps (Tags, Review) and click "Create user"
9. **IMPORTANT**: You will now see a page with the Access Key ID and Secret Access Key
   - The Access Key ID looks like: AKIAIOSFODNN7EXAMPLE
   - The Secret Access Key looks like: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   - You must download the CSV file or copy these values immediately
   - These credentials will never be shown again after you leave this page
   - If you lose them, you'll need to generate new ones

Note: If you need to create new access keys later:
1. Go to the IAM service and select the user
2. Go to the "Security credentials" tab
3. In the "Access keys" section, click "Create access key"
4. Follow the prompts and securely store the new credentials

## Step 5: Update Your Environment Variables

1. Open your project's `.env` file
2. Update the AWS configuration values:

```
VITE_AWS_ACCESS_KEY_ID=your-access-key-id
VITE_AWS_SECRET_ACCESS_KEY=your-secret-access-key
VITE_AWS_REGION=your-bucket-region (e.g., us-east-1)
VITE_AWS_S3_BUCKET_NAME=your-bucket-name
```

## Step 6: Test the Configuration

1. Start your application
2. Navigate to a repository
3. Click the "Upload File" button
4. In the dialog that appears, click the "Test S3" tab
5. Click "Test CORS Configuration" to verify your S3 settings
6. If the test fails, follow the instructions provided in the dialog to fix your CORS configuration

## Security Best Practices

For a production environment, consider these additional security measures:

1. Create a custom IAM policy that restricts access to only the necessary S3 operations and specific bucket
2. Set up proper bucket policies to restrict access
3. Enable server-side encryption for your S3 bucket
4. Implement pre-signed URLs with short expiration times
5. Regularly rotate your access keys
6. Set up CloudTrail to monitor S3 access

## Troubleshooting

### Using the Built-in S3 Configuration Tester

The application includes a built-in S3 configuration tester to help diagnose issues:

1. Navigate to any repository
2. Click the "Upload File" button
3. Select the "Test S3" tab
4. The tester will display your current configuration status
5. Click "Test CORS Configuration" to verify your CORS settings
6. If issues are found, the tester will provide specific error messages and recommended configuration

### Common Issues

- **CORS Issues**: If you encounter CORS errors during file uploads, use the Test S3 feature to check your CORS configuration. The tester will provide the exact JSON configuration you should use.

- **Access Denied**: Verify that your IAM user has the correct permissions for the S3 bucket. The minimum required permission is `s3:PutObject` for the specific bucket you're using.

- **Invalid Credentials**: Double-check that the access key and secret key in your .env file are correct. The S3 tester will indicate if your credentials are properly configured.

- **Region Conflicts**: Make sure the region specified in your environment variables matches the region where your bucket was created.

- **Upload Failures**: If file uploads fail, check the browser console for detailed error messages. The application provides extended logging to help diagnose S3-related issues.

For additional help, refer to the [AWS S3 Documentation](https://docs.aws.amazon.com/s3/index.html). 