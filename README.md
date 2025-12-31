# AR Event & Alert Engine

An **Accounts Receivable Event & Alert Engine** built with event sourcing principles. This system tracks AR lifecycle, queues alerts, and integrates with Telegram for delivery - all while maintaining a full audit trail through append-only events.

## Core Principles

- **Event Sourcing**: Append-only event log as the source of truth
- **Derived State**: AR state is computed from events and can be rebuilt
- **Alert Queueing**: System queues alerts, never sends directly
- **Identity Separation**: `customer_id` = identity, `chat_id` = delivery address only
- **Manager Visibility**: All critical actions are visible to managers

## Technology Stack

- **Backend**: Node.js + TypeScript
- **Database**: MongoDB (event store + state store)
- **Messaging**: Telegram Bot API
- **Deployment**: Docker + Docker Compose

## Architecture

The system follows **Hexagonal Architecture** with clear separation:

- **Domain Layer**: Pure business logic (events, models, services)
- **Application Layer**: Use cases (commands, queries)
- **Infrastructure Layer**: External concerns (MongoDB, Telegram)
- **API Layer**: HTTP endpoints

## Quick Start

### Prerequisites

- Node.js 18+ or Docker
- MongoDB 7+ (or use Docker Compose)
- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))

### Option 1: Docker Compose (Recommended)

1. Clone the repository
2. Copy environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your `TELEGRAM_BOT_TOKEN`
4. Start all services:
   ```bash
   docker-compose -f docker/docker-compose.yml up -d
   ```
5. Check health:
   ```bash
   curl http://localhost:3000/health
   ```

### Option 2: Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start MongoDB locally or update `MONGODB_URI` in `.env`
3. Copy and configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```
4. Build TypeScript:
   ```bash
   npm run build
   ```
5. Start application:
   ```bash
   npm start
   ```

## API Endpoints

### AR Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ar` | Create new AR |
| GET | `/api/ar/:ar_id` | Get AR state by ID |
| GET | `/api/ar/customer/:customer_id` | Get ARs for customer |
| GET | `/api/ar/sales/:sales_id` | Get ARs for sales person |
| POST | `/api/ar/:ar_id/follow-up` | Log follow-up note |
| POST | `/api/ar/:ar_id/verify-payment` | Verify payment received |

### Alert Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts/pending` | Get pending alerts |
| GET | `/api/alerts/ar/:ar_id` | Get alerts for AR |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

## Usage Examples

### Create an AR

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

### Get AR State

```bash
curl http://localhost:3000/api/ar/{ar_id}
```

### Log Follow-Up

```bash
curl -X POST http://localhost:3000/api/ar/{ar_id}/follow-up \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Called customer, they will pay next week",
    "next_action": "Follow up again if not paid",
    "next_action_date": "2025-02-07",
    "actor_user_id": "MGR001",
    "actor_type": "MANAGER"
  }'
```

### Verify Payment

```bash
curl -X POST http://localhost:3000/api/ar/{ar_id}/verify-payment \
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

## Event Types

The system generates the following events:

- `AR_CREATED` - New AR created
- `STATUS_CHANGED` - AR status changed
- `FOLLOW_UP_LOGGED` - Follow-up note logged
- `PAYMENT_VERIFIED` - Payment verified
- `ALERT_QUEUED` - Alert queued for delivery
- `ALERT_SENT` - Alert successfully sent
- `ALERT_FAILED` - Alert delivery failed

## Alert Types

- `PRE_ALERT` - Reminder before due date (default: 3 days)
- `DUE` - On due date
- `OVERDUE` - After due date
- `ESCALATION` - Manager escalation

## Background Workers

### Alert Processor Worker
- Polls alert queue every 10 seconds (configurable)
- Delivers alerts via Telegram
- Handles retries with exponential backoff (max 3 attempts)

### Date Checker Worker
- Runs daily at 9 AM (configurable via cron)
- Checks for due ARs and queues appropriate alerts
- Sends pre-alerts 3 days before due date
- Escalates overdue ARs to managers

## Configuration

Environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | HTTP server port | 3000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `MONGODB_DB_NAME` | Database name | ar_tracker |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | - |
| `ALERT_POLL_INTERVAL_MS` | Alert queue poll interval | 10000 |
| `MAX_ALERT_RETRIES` | Max retry attempts | 3 |
| `DATE_CHECKER_CRON` | Cron schedule for date checker | 0 9 * * * |
| `PREALERT_DAYS` | Days before due for pre-alert | 3 |

## MongoDB Collections

### events (Append-Only)
- Event store with full audit trail
- Indexed by event_id, ar_id, event_type

### ar_state (Materialized View)
- Current AR state derived from events
- Rebuildable from event history
- Indexed by ar_id, customer_id, status, due_date

### alert_queue (Alert Staging)
- Queued alerts waiting for delivery
- Indexed by alert_id, status, scheduled_for

## Development

### Build
```bash
npm run build
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Docker Build
```bash
npm run docker:build
```

### Docker Start
```bash
npm run docker:up
```

### Docker Stop
```bash
npm run docker:down
```

### View Logs
```bash
npm run docker:logs
```

## Project Structure

```
payment-tracker/
├── src/
│   ├── domain/              # Core business logic
│   │   ├── events/          # Event definitions
│   │   ├── models/          # Domain models
│   │   ├── services/        # Domain services
│   │   └── repositories/    # Repository interfaces
│   ├── infrastructure/      # External integrations
│   │   ├── database/        # MongoDB implementations
│   │   └── messaging/       # Telegram client
│   ├── application/         # Use cases
│   │   ├── commands/        # Command handlers
│   │   └── queries/         # Query handlers
│   ├── api/                 # HTTP layer
│   │   ├── routes/          # API routes
│   │   └── middleware/      # Express middleware
│   ├── workers/             # Background workers
│   ├── config/              # Configuration
│   └── index.ts             # Entry point
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Strict Constraints

The system enforces these constraints:

1. ✅ **Never modify/delete events** - Append-only
2. ✅ **customer_id is identity** - Never use chat_id for business logic
3. ✅ **Queue alerts, don't send** - System queues, worker delivers
4. ✅ **Manager visibility always** - Manager gets copy of all alerts
5. ✅ **No direct customer contact** - Only via queued alerts
6. ✅ **Payment verification required** - Never infer payment
7. ✅ **AR state is derived** - Can be rebuilt from events

## Future Extensions

- Multiple delivery channels (WhatsApp, Email, SMS)
- Advanced escalation rules and routing
- Event snapshots for performance
- Analytics dashboard with event projections
- CQRS with separate read/write databases
- Webhook support for external integrations

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
