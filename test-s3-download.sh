#!/bin/bash

echo "🧪 Testing S3 Download Functionality"
echo "===================================="

# Set environment variables
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/mytracks?sslmode=disable"
export GPX_S3_URL="https://s3.us-west-2.amazonaws.com/app2.triptracks.io/gpx_files.tar.gz"
export GPX_PATH="./test_gpx_files.tar.gz"

echo "📍 Test configuration:"
echo "  - S3 URL: $GPX_S3_URL"
echo "  - Local path: $GPX_PATH"
echo ""

# Clean up any existing test file
if [ -f "$GPX_PATH" ]; then
    echo "🧹 Cleaning up existing test file..."
    rm "$GPX_PATH"
fi

echo "🏗️  Building Go application..."
cd api
if ! go build -o test-s3-download .; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful!"
echo ""

echo "🌐 Testing S3 download (this may take a few minutes for 185MB file)..."
echo "   Note: The app will download the file and then exit (database connection will fail)"
echo ""

# Run the application - it will download the file and then fail on DB connection
# We'll capture the output and check if download was successful
timeout 300 ./test-s3-download 2>&1 | tee download_test.log &
PID=$!

# Wait for the process or timeout
wait $PID
RESULT=$?

echo ""
echo "📊 Test Results:"
echo "================"

# Check if the file was downloaded
if [ -f "../$GPX_PATH" ]; then
    FILE_SIZE=$(ls -lh "../$GPX_PATH" | awk '{print $5}')
    echo "✅ GPX archive downloaded successfully!"
    echo "   File size: $FILE_SIZE"
    echo "   Location: ../$GPX_PATH"
else
    echo "❌ GPX archive was not downloaded"
fi

# Check download log for success messages
if grep -q "Successfully downloaded.*bytes" download_test.log; then
    echo "✅ Download completed successfully according to logs"
else
    echo "⚠️  Download may not have completed successfully"
fi

# Show relevant log lines
echo ""
echo "📋 Relevant log output:"
echo "======================"
grep -E "(Downloading|Successfully downloaded|GPX archive|Failed)" download_test.log || echo "No relevant log lines found"

# Clean up
echo ""
echo "🧹 Cleaning up test files..."
rm -f test-s3-download download_test.log
if [ -f "../$GPX_PATH" ]; then
    rm "../$GPX_PATH"
    echo "   Removed test GPX archive"
fi

echo ""
echo "✨ Test completed!"
