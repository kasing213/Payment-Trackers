# Excel Processor (Local)

Standalone application that processes Excel files locally and syncs AR records to Railway-hosted API.

## Architecture

This local processor is part of a hybrid architecture:
- **Railway Cloud**: Core AR system (events, AR state, alerts, API)
- **Local Excel Processor**: Processes Excel files with local file system access

## Features

- Watches local folder for new Excel files (.xlsx)
- Parses Excel files with Khmer Unicode support
- Uses GPT-4o-mini for data normalization and validation
- Detects duplicates via Railway API
- Creates new ARs or updates existing ones
- Saves import logs to both local files and Railway MongoDB

## Setup

### Prerequisites

- Node.js >= 18.0.0
- Railway API deployed and running
- OpenAI API key
- Valid Railway API key

### Installation

1. Navigate to the excel-processor-local directory:
```bash
cd excel-processor-local
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
RAILWAY_API_URL=https://your-app.railway.app
API_KEY=your-railway-api-key
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
EXCEL_UPLOAD_FOLDER=d:/Payment-Tracker/uploads/excel
EXCEL_PROCESSING_FOLDER=d:/Payment-Tracker/uploads/processing
EXCEL_PROCESSED_FOLDER=d:/Payment-Tracker/uploads/processed
EXCEL_FAILED_FOLDER=d:/Payment-Tracker/uploads/failed
EXCEL_BATCH_SIZE=10
```

5. Create upload folders:
```bash
mkdir -p uploads/excel
mkdir -p uploads/processing
mkdir -p uploads/processed
mkdir -p uploads/failed
```

## Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

1. Build the project:
```bash
npm run build
```

2. Start the processor:
```bash
npm start
```

### Processing Excel Files

1. Drop Excel files (.xlsx) into the upload folder
2. The processor will automatically:
   - Parse the Excel file
   - Normalize data with GPT-4o-mini
   - Check for duplicates via Railway API
   - Create new ARs or update existing ones
   - Move file to `processed/` (success) or `failed/` (error)
   - Save import summary as JSON

### File Lifecycle

```
uploads/excel/          ← Drop files here
    ↓
uploads/processing/     ← File moved during processing
    ↓ (on success)
uploads/processed/YYYY-MM-DD/filename_timestamp.xlsx + summary.json
    ↓ (on failure)
uploads/failed/YYYY-MM-DD/filename_timestamp.xlsx + error.json
```

## Import Summary

After processing, a summary JSON file is created:

```json
{
  "import_id": "uuid",
  "file_name": "customer_payments.xlsx",
  "started_at": "2025-01-01T10:00:00.000Z",
  "completed_at": "2025-01-01T10:05:00.000Z",
  "status": "COMPLETED",
  "total_rows": 15,
  "successful_rows": 10,
  "updated_rows": 2,
  "duplicate_rows": 1,
  "failed_rows": 2,
  "errors": [...]
}
```

## Duplicate Handling

- **Exact Duplicate** (all data identical) → **SKIP** - No event, no update
- **Data Changed** (amount, due_date, or currency different) → **UPDATE** - Create update events

## Error Handling

| Error Type | Strategy |
|------------|----------|
| Excel parse error | Move to `failed/`, log error |
| GPT API failure | Retry 3x with exponential backoff |
| Validation error | Skip row, log error, continue |
| Railway API failure | Move to `failed/`, log error |

## Troubleshooting

### Cannot connect to Railway API

Check:
1. `RAILWAY_API_URL` is correct and accessible
2. `API_KEY` matches the Railway deployment
3. Railway service is running (check `/health` endpoint)

### GPT Processing Errors

Check:
1. `OPENAI_API_KEY` is valid
2. OpenAI account has available credits
3. Check OpenAI API status

### File Not Processing

Check:
1. File is in the correct upload folder
2. File has `.xlsx` extension
3. File is not corrupt (can open in Excel)
4. Check console logs for errors

## Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Run built application
- `npm run dev` - Run with ts-node (development)
- `npm run watch` - Run with auto-reload on file changes
- `npm run clean` - Remove build artifacts

## Support

For issues or questions, check the main project README or logs.
