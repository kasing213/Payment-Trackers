#!/bin/bash
# Log Viewer Script for Payment Tracker

echo "=== Payment Tracker Log Viewer ==="
echo ""

# 1. List recent failed imports
echo "📁 Failed Excel Imports (Last 7 days):"
find uploads/failed -name "*.json" -type f -mtime -7 2>/dev/null | while read file; do
    echo "  - $file"
    echo "    Status: $(cat "$file" | grep -o '"status":"[^"]*"' | head -1)"
    echo "    Errors: $(cat "$file" | grep -o '"failed_rows":[^,]*' | head -1)"
done

echo ""

# 2. Show Excel processor status
echo "📊 Excel Processor Status:"
if [ -f "excel-processor-local/dist/index.js" ]; then
    echo "  ✅ Built successfully"
else
    echo "  ❌ Not built - run: cd excel-processor-local && npm run build"
fi

echo ""

# 3. Show Railway API status
echo "🚂 Railway API Status:"
if [ -f "dist/index.js" ]; then
    echo "  ✅ Built successfully"
else
    echo "  ❌ Not built - run: npm run build"
fi

echo ""

# 4. MongoDB connection test
echo "🗄️  MongoDB Connection:"
if command -v mongosh &> /dev/null; then
    mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null && echo "  ✅ Connected" || echo "  ❌ Not connected"
else
    echo "  ⚠️  mongosh not installed"
fi

echo ""

# 5. View latest error log
echo "🔍 Latest Error (if any):"
LATEST_ERROR=$(find uploads/failed -name "*.json" -type f -mtime -1 2>/dev/null | head -1)
if [ -n "$LATEST_ERROR" ]; then
    echo "  File: $LATEST_ERROR"
    echo ""
    cat "$LATEST_ERROR" | grep -A 10 '"errors":'
else
    echo "  ✅ No recent errors"
fi

echo ""
echo "=== Commands ==="
echo "  View all failed imports:  ls -lR uploads/failed/"
echo "  View specific log:        cat uploads/failed/YYYY-MM-DD/error_*.json | jq ."
echo "  Watch Excel processor:    cd excel-processor-local && npm run dev"
echo "  Watch Railway API:        npm run dev"
echo "  Query MongoDB logs:       mongosh payment_tracker --eval 'db.excel_import_logs.find().limit(5).pretty()'"
