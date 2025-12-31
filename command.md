# AR Event & Alert Engine - Startup Guide

Complete guide to set up, configure, and run the AR Event & Alert Engine with Excel processing.

---

## Prerequisites

### Required Software
- **Node.js**: 18+ ([download](https://nodejs.org/))
- **MongoDB**: 7+ ([download](https://www.mongodb.com/try/download/community))
- **Docker** (optional): For containerized deployment

### Required API Keys
- **Telegram Bot Token**: Get from [@BotFather](https://t.me/botfather)
- **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

---

## 1. Initial Setup

### Clone & Install Dependencies

```bash
# Navigate to project directory
cd d:\Payment-Tracker

# Install all dependencies
npm install
```

**Expected Dependencies** (check [package.json](package.json)):
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "mongodb": "^6.3.0",
    "node-telegram-bot-api": "^0.64.0",
    "uuid": "^9.0.1",
    "dotenv": "^16.3.1",
    "axios": "^1.6.2",
    "xlsx": "^0.18.5",
    "chokidar": "^3.5.3",
    "openai": "^4.20.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/uuid": "^9.0.7",
    "@types/xlsx": "^0.0.36",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.2",
    "nodemon": "^3.0.2"
  }
}
```

---

## 2. Environment Configuration

### Create .env File

```bash
# Copy the example file
cp .env.example .env
```

### Edit .env with Required Values

Open `.env` in your editor and configure:

```env
# Application
NODE_ENV=development
PORT=3000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/ar_tracker
MONGODB_DB_NAME=ar_tracker

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN_HERE>

# OpenAI Configuration (for Excel processing)
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY_HERE>
OPENAI_MODEL=gpt-4o-mini

# Alert Configuration
ALERT_POLL_INTERVAL_MS=10000
MAX_ALERT_RETRIES=3
DATE_CHECKER_CRON=0 9 * * *
PREALERT_DAYS=3

# Excel Processing Configuration
EXCEL_UPLOAD_FOLDER=d:/Payment-Tracker/uploads/excel
EXCEL_PROCESSING_FOLDER=d:/Payment-Tracker/uploads/processing
EXCEL_PROCESSED_FOLDER=d:/Payment-Tracker/uploads/processed
EXCEL_FAILED_FOLDER=d:/Payment-Tracker/uploads/failed
EXCEL_BATCH_SIZE=10
```

**Critical Variables:**
- `TELEGRAM_BOT_TOKEN`: Required for alert delivery
- `OPENAI_API_KEY`: Required for Excel file processing
- `MONGODB_URI`: Must point to running MongoDB instance

---

## 3. Database Setup

### Option A: Local MongoDB

**Start MongoDB:**
```bash
# Windows
mongod --dbpath d:\data\db

# macOS/Linux
mongod --dbpath /data/db
```

**Create Indexes** (run after first startup):
```bash
# Connect to MongoDB shell
mongosh mongodb://localhost:27017/ar_tracker

# Run index creation script
db.events.createIndex({ event_id: 1 }, { unique: true });
db.events.createIndex({ ar_id: 1, timestamp: 1 });
db.events.createIndex({ event_type: 1, timestamp: -1 });

db.ar_state.createIndex({ ar_id: 1 }, { unique: true });
db.ar_state.createIndex({ customer_id: 1 });
db.ar_state.createIndex({ current_status: 1, due_date: 1 });
db.ar_state.createIndex({ due_date: 1 });

db.alert_queue.createIndex({ alert_id: 1 }, { unique: true });
db.alert_queue.createIndex({ status: 1, scheduled_for: 1 });
db.alert_queue.createIndex({ ar_id: 1, created_at: -1 });

db.excel_import_logs.createIndex({ import_id: 1 }, { unique: true });
db.excel_import_logs.createIndex({ status: 1, started_at: -1 });
db.excel_import_logs.createIndex({ file_name: 1, started_at: -1 });
```

### Option B: Docker Compose (Recommended)

```bash
# Start MongoDB + Application (all services)
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f

# Stop all services
docker-compose -f docker/docker-compose.yml down
```

**Note:** Docker Compose automatically creates indexes on startup.

---

## 4. Folder Structure Setup

### Create Upload Folders

```bash
# Create all required folders for Excel processing
mkdir -p uploads/excel
mkdir -p uploads/processing
mkdir -p uploads/processed
mkdir -p uploads/failed
```

**Folder Purposes:**
- `uploads/excel/` - Drop Excel files here (monitored by file watcher)
- `uploads/processing/` - Files being processed (temporary)
- `uploads/processed/YYYY-MM-DD/` - Successfully processed files + summary.json
- `uploads/failed/YYYY-MM-DD/` - Failed files + error.json

---

## 5. Build & Start Application

### Development Mode (with auto-reload)

```bash
# Build TypeScript
npm run build

# Start with nodemon (auto-restarts on file changes)
npm run dev
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Start application
npm start
```

**Expected Output:**
```
[INFO] MongoDB connected: ar_tracker
[INFO] Alert Processor Worker started (polling every 10s)
[INFO] Date Checker Worker scheduled (cron: 0 9 * * *)
[INFO] Excel Processor Worker started (watching: d:/Payment-Tracker/uploads/excel)
[INFO] HTTP Server listening on port 3000
```

---

## 6. Verify System Health

### Health Check

```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-31T10:30:00.000Z",
  "services": {
    "mongodb": "connected",
    "telegram": "ready",
    "excel_worker": "running"
  }
}
```

### Check MongoDB Collections

```bash
mongosh mongodb://localhost:27017/ar_tracker

# List collections
show collections

# Expected output:
# events
# ar_state
# alert_queue
# excel_import_logs
```

---

## 7. Using the System

### A. Create AR via API

```bash
curl -X POST http://localhost:3000/api/ar \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST001",
    "customer_name": "Acme Corp",
    "amount": {
      "value": 5000,
      "currency": "USD"
    },
    "invoice_date": "2025-01-01",
    "due_date": "2025-01-31",
    "customer_chat_id": "123456789",
    "manager_chat_id": "987654321"
  }'
```

**Response:**
```json
{
  "ar_id": "AR_550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "AR created successfully"
}
```

### B. Get AR State

```bash
curl http://localhost:3000/api/ar/AR_550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "ar_id": "AR_550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "CUST001",
  "customer_name": "Acme Corp",
  "amount": {
    "value": 5000,
    "currency": "USD"
  },
  "current_status": "PENDING",
  "invoice_date": "2025-01-01T00:00:00.000Z",
  "due_date": "2025-01-31T00:00:00.000Z",
  "event_count": 1,
  "last_event_at": "2025-12-31T10:30:00.000Z"
}
```

### C. Log Follow-Up

```bash
curl -X POST http://localhost:3000/api/ar/AR_550e8400-e29b-41d4-a716-446655440000/follow-up \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Called customer, they will pay next week",
    "next_action": "Follow up again if not paid",
    "next_action_date": "2025-02-07",
    "actor_user_id": "MGR001",
    "actor_type": "MANAGER"
  }'
```

### D. Verify Payment

```bash
curl -X POST http://localhost:3000/api/ar/AR_550e8400-e29b-41d4-a716-446655440000/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "paid_amount": {
      "value": 5000,
      "currency": "USD"
    },
    "payment_date": "2025-01-25",
    "verification_method": "BANK_STATEMENT",
    "verified_by": "MGR001"
  }'
```

### E. Get Pending Alerts

```bash
curl http://localhost:3000/api/alerts/pending
```

---

## 8. Excel File Processing

### Prepare Excel File

**Expected Format:**
- Customer name (supports Khmer Unicode)
- Amount (e.g., "150,000 KHR" or "$5,000")
- Invoice date (e.g., "31/12/2025")
- Due date (e.g., "31/01/2026")
- Notes (optional, Khmer supported)

**Sample File:** `តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25.xlsx`

### Upload Excel File

```bash
# Copy file to upload folder
cp "d:\Payment-Tracker\តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25.xlsx" uploads/excel/

# The Excel Processor Worker will automatically:
# 1. Detect the file (chokidar file watcher)
# 2. Move to uploads/processing/
# 3. Parse Excel → extract rows
# 4. Send to GPT-4o-mini for normalization
# 5. Detect duplicates
# 6. Create/update ARs via event sourcing
# 7. Move to uploads/processed/ (success) or uploads/failed/ (error)
```

### Monitor Processing

**Watch Application Logs:**
```bash
# View real-time logs
tail -f logs/app.log

# Expected output:
[INFO] Excel file detected: តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25.xlsx
[INFO] Parsing Excel file: 15 rows found
[INFO] Sending batch 1/2 to GPT-4o-mini (10 rows)
[INFO] Sending batch 2/2 to GPT-4o-mini (5 rows)
[INFO] Processing row 1: New AR created (AR_xyz123)
[INFO] Processing row 2: Exact duplicate, skipping
[INFO] Processing row 3: Data changed, updating AR (AR_abc456)
[INFO] Import completed: 15 total, 10 new, 2 updated, 1 duplicate, 2 failed
[INFO] File moved to: uploads/processed/2025-12-31/តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25_1735650000.xlsx
```

### Check Import Results

**Query Import Logs:**
```bash
mongosh mongodb://localhost:27017/ar_tracker

db.excel_import_logs.find().sort({ started_at: -1 }).limit(1).pretty()
```

**Expected Output:**
```json
{
  "import_id": "uuid-here",
  "file_name": "តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25.xlsx",
  "started_at": "2025-12-31T10:00:00.000Z",
  "completed_at": "2025-12-31T10:01:30.000Z",
  "status": "COMPLETED",
  "total_rows": 15,
  "successful_rows": 10,    // New ARs created
  "updated_rows": 2,        // Existing ARs updated (data changed)
  "duplicate_rows": 1,      // Exact duplicates (skipped)
  "failed_rows": 2,
  "errors": [
    { "row_index": 5, "error_type": "VALIDATION_ERROR", "error_message": "Invalid date format" },
    { "row_index": 8, "error_type": "VALIDATION_ERROR", "error_message": "Missing amount" }
  ]
}
```

**Check Summary File:**
```bash
# View processing summary
cat "uploads/processed/2025-12-31/summary_តារាងអតិថិជន​បង់ប្រាក់ប្រចាំខែ12_25_1735650000.json"
```

---

## 9. Background Workers

### Alert Processor Worker
- **Purpose**: Processes alert queue and delivers via Telegram
- **Polling Interval**: 10 seconds (configurable via `ALERT_POLL_INTERVAL_MS`)
- **Retry Logic**: 3 attempts with exponential backoff
- **Status**: Auto-starts with application

**Monitor:**
```bash
# Check pending alerts
curl http://localhost:3000/api/alerts/pending

# Watch worker logs
tail -f logs/app.log | grep "Alert Processor"
```

### Date Checker Worker
- **Purpose**: Daily cron job to check due dates and queue alerts
- **Schedule**: 9 AM daily (configurable via `DATE_CHECKER_CRON`)
- **Actions**:
  - Pre-alerts: 3 days before due date
  - Due alerts: On due date
  - Overdue alerts: After due date
  - Escalation: Manager notification for overdue ARs

**Manual Trigger** (for testing):
```bash
curl -X POST http://localhost:3000/api/admin/trigger-date-checker
```

### Excel Processor Worker
- **Purpose**: Monitors upload folder for new Excel files
- **Technology**: Chokidar file watcher
- **Status**: Auto-starts with application

**Monitor:**
```bash
# Check upload folder
ls -la uploads/excel/

# View worker status
curl http://localhost:3000/api/admin/worker-status
```

---

## 10. Database Queries (Useful Commands)

### View All ARs
```javascript
mongosh mongodb://localhost:27017/ar_tracker

// Find all ARs
db.ar_state.find().pretty()

// Find overdue ARs
db.ar_state.find({
  current_status: "OVERDUE",
  due_date: { $lt: new Date() }
}).pretty()

// Find ARs by customer
db.ar_state.find({ customer_id: "CUST001" }).pretty()
```

### View Events for Specific AR
```javascript
// Get event history
db.events.find({ ar_id: "AR_550e8400-e29b-41d4-a716-446655440000" })
  .sort({ timestamp: 1 })
  .pretty()
```

### View Alert Queue
```javascript
// Pending alerts
db.alert_queue.find({ status: "QUEUED" }).pretty()

// Failed alerts (need retry)
db.alert_queue.find({ status: "FAILED" }).pretty()
```

### View Excel Import History
```javascript
// Recent imports
db.excel_import_logs.find()
  .sort({ started_at: -1 })
  .limit(10)
  .pretty()

// Failed imports only
db.excel_import_logs.find({ status: "FAILED" }).pretty()
```

---

## 11. Troubleshooting

### Application Won't Start

**Problem:** Port 3000 already in use
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (Windows)
taskkill /PID <PID> /F

# Kill the process (macOS/Linux)
kill -9 <PID>
```

**Problem:** MongoDB connection failed
```bash
# Check if MongoDB is running
mongosh mongodb://localhost:27017

# If not running, start MongoDB
mongod --dbpath d:\data\db
```

### Excel Files Not Processing

**Problem:** File watcher not detecting files
```bash
# Check upload folder path in .env
echo $EXCEL_UPLOAD_FOLDER

# Verify folder exists
ls -la uploads/excel/

# Check worker logs
tail -f logs/app.log | grep "Excel Processor"
```

**Problem:** GPT API errors
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Check OpenAI API status
curl https://status.openai.com/
```

### Alerts Not Sending

**Problem:** Telegram bot token invalid
```bash
# Test bot token
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# Expected response: bot details
```

**Problem:** No alerts in queue
```bash
# Check alert queue
mongosh mongodb://localhost:27017/ar_tracker
db.alert_queue.find({ status: "QUEUED" }).count()

# Manually trigger date checker
curl -X POST http://localhost:3000/api/admin/trigger-date-checker
```

### View Application Logs

```bash
# Real-time logs
tail -f logs/app.log

# Search for errors
grep ERROR logs/app.log

# Search for specific AR
grep "AR_550e8400" logs/app.log
```

---

## 12. Docker Commands (Quick Reference)

### Start All Services
```bash
docker-compose -f docker/docker-compose.yml up -d
```

### View Logs
```bash
# All services
docker-compose -f docker/docker-compose.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.yml logs -f app
docker-compose -f docker/docker-compose.yml logs -f mongodb
```

### Stop Services
```bash
docker-compose -f docker/docker-compose.yml down
```

### Restart Service
```bash
docker-compose -f docker/docker-compose.yml restart app
```

### Execute Commands in Container
```bash
# MongoDB shell
docker exec -it ar-mongodb mongosh -u admin -p password

# Application shell
docker exec -it ar-app sh
```

### View Container Status
```bash
docker-compose -f docker/docker-compose.yml ps
```

---

## 13. API Endpoints Reference

### AR Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ar` | Create new AR |
| GET | `/api/ar/:ar_id` | Get AR state by ID |
| GET | `/api/ar/customer/:customer_id` | Get ARs for customer |
| GET | `/api/ar/sales/:sales_id` | Get ARs for sales person |
| POST | `/api/ar/:ar_id/follow-up` | Log follow-up note |
| POST | `/api/ar/:ar_id/verify-payment` | Verify payment received |
| POST | `/api/ar/:ar_id/change-due-date` | Change due date |
| POST | `/api/ar/:ar_id/change-status` | Change status |

### Alert Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts/pending` | Get pending alerts |
| GET | `/api/alerts/ar/:ar_id` | Get alerts for AR |
| GET | `/api/alerts/failed` | Get failed alerts |

### Admin Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/trigger-date-checker` | Manually trigger date checker |
| GET | `/api/admin/worker-status` | Get worker status |
| GET | `/api/admin/import-history` | Get Excel import history |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## 14. Testing the System

### End-to-End Test Flow

```bash
# 1. Create an AR
AR_ID=$(curl -s -X POST http://localhost:3000/api/ar \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "CUST_TEST",
    "customer_name": "Test Customer",
    "amount": {"value": 1000, "currency": "USD"},
    "invoice_date": "2025-12-01",
    "due_date": "2025-12-31"
  }' | jq -r '.ar_id')

echo "Created AR: $AR_ID"

# 2. Verify AR state
curl http://localhost:3000/api/ar/$AR_ID | jq

# 3. Log follow-up
curl -X POST http://localhost:3000/api/ar/$AR_ID/follow-up \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Test follow-up",
    "actor_user_id": "TEST_MGR",
    "actor_type": "MANAGER"
  }'

# 4. Verify payment
curl -X POST http://localhost:3000/api/ar/$AR_ID/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
    "paid_amount": {"value": 1000, "currency": "USD"},
    "payment_date": "2025-12-31",
    "verification_method": "BANK_STATEMENT",
    "verified_by": "TEST_MGR"
  }'

# 5. Check final state
curl http://localhost:3000/api/ar/$AR_ID | jq
```

### Excel Import Test

```bash
# 1. Prepare test Excel file
# Create a simple Excel file with:
# - Column A: Customer Name
# - Column B: Amount (e.g., "150,000 KHR")
# - Column C: Invoice Date (e.g., "01/12/2025")
# - Column D: Due Date (e.g., "31/12/2025")

# 2. Drop file in upload folder
cp test_payment_data.xlsx uploads/excel/

# 3. Wait for processing (check logs)
tail -f logs/app.log

# 4. Check import results
curl http://localhost:3000/api/admin/import-history | jq

# 5. Verify ARs were created
curl http://localhost:3000/api/ar | jq
```

---

## 15. Production Deployment Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Use strong MongoDB credentials
- [ ] Enable MongoDB authentication
- [ ] Set up MongoDB backups (daily recommended)
- [ ] Configure firewall (allow only port 3000 for API)
- [ ] Set up SSL/TLS for HTTPS
- [ ] Configure reverse proxy (nginx/Apache)
- [ ] Set up log rotation
- [ ] Enable monitoring (PM2, New Relic, etc.)
- [ ] Test alert delivery with real Telegram bot
- [ ] Test Excel processing with production data
- [ ] Set up error alerting (email/Slack)
- [ ] Document runbook for on-call support

---

## 16. Common npm Scripts

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start application (production)
npm start

# Start with auto-reload (development)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Docker build
npm run docker:build

# Docker start
npm run docker:up

# Docker stop
npm run docker:down

# View Docker logs
npm run docker:logs
```

---

## Support & Documentation

- **README**: [README.md](README.md) - System overview
- **Architecture Plan**: `C:\Users\SH Computer\.claude\plans\partitioned-prancing-lightning.md`
- **API Documentation**: Auto-generated Swagger UI at `http://localhost:3000/api-docs`

For issues, check logs at `logs/app.log` or MongoDB collections for event history.

---

**Last Updated**: 2025-12-31
**System Version**: 1.0.0 (MVP + Excel Processing)
