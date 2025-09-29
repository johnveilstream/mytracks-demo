# S3 GPX Archive Setup

This document explains how the application handles GPX file storage using Amazon S3.

## Overview

The MyTracks application now uses S3 to store the compressed GPX archive instead of including it in the git repository. This provides several benefits:

- **Cleaner Repository**: No large binary files in git history
- **Dynamic Loading**: Archive is downloaded on-demand
- **Scalability**: Easy to update GPX data without code changes
- **Storage Efficiency**: Reduces repository clone time and size

## How It Works

1. **Startup Check**: When the API starts, it checks if `gpx_files.tar.gz` exists locally
2. **S3 Download**: If missing, it automatically downloads from the configured S3 URL
3. **Local Caching**: Once downloaded, the file is cached locally for future use
4. **Archive Processing**: The API reads GPX files directly from the compressed archive

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GPX_S3_URL` | `https://s3.us-west-2.amazonaws.com/app2.triptracks.io/gpx_files.tar.gz` | S3 URL for the GPX archive |
| `GPX_PATH` | `/app/gpx_files.tar.gz` | Local path where archive is stored/downloaded |

### Docker Compose

The S3 URL is configured in `docker-compose.yml`:

```yaml
api:
  environment:
    - GPX_S3_URL=https://s3.us-west-2.amazonaws.com/app2.triptracks.io/gpx_files.tar.gz
```

## S3 Bucket Setup

### Current Configuration

- **Bucket**: `app2.triptracks.io`
- **Region**: `us-west-2`
- **File**: `gpx_files.tar.gz` (185MB compressed, contains 14,065 GPX files)
- **Access**: Public read access

### Updating the Archive

To update the GPX data:

1. Create a new `gpx_files.tar.gz` archive:
   ```bash
   tar -czf gpx_files.tar.gz gpx_files/
   ```

2. Upload to S3:
   ```bash
   aws s3 cp gpx_files.tar.gz s3://app2.triptracks.io/gpx_files.tar.gz --acl public-read
   ```

3. Restart the application - it will download the new archive

## Local Development

### Using Local Archive

For development, you can use a local archive by setting:

```bash
export GPX_PATH="./local_gpx_files.tar.gz"
export GPX_S3_URL="file://./local_gpx_files.tar.gz"  # Won't actually download
```

### Testing S3 Download

Use the provided test script:

```bash
./test-s3-download.sh
```

This will:
- Build the Go application
- Test the S3 download functionality
- Verify the archive is downloaded correctly
- Clean up test files

## Monitoring

### Download Logs

The application logs download progress:

```
GPX archive not found locally, downloading from S3...
Downloading https://s3.us-west-2.amazonaws.com/.../gpx_files.tar.gz to /app/gpx_files.tar.gz...
Successfully downloaded 194809431 bytes to /app/gpx_files.tar.gz
```

### Health Check

The `/health` endpoint will return an error if the GPX archive cannot be accessed.

## Troubleshooting

### Common Issues

1. **Download Timeout**: Increase timeout in `DownloadService` if needed
2. **Network Issues**: Check internet connectivity and S3 access
3. **Disk Space**: Ensure sufficient space (200MB+) for the archive
4. **Permissions**: Verify write permissions to the target directory

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "failed to download file" | Network/S3 access issue | Check URL and connectivity |
| "failed to create file" | Permission issue | Check directory permissions |
| "download failed with status: 404" | File not found on S3 | Verify S3 URL and file existence |

## Security Considerations

- The S3 bucket is configured for public read access
- No authentication is required for downloading
- Consider using signed URLs for private buckets
- Monitor S3 access logs for unusual activity
