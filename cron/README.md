# Circulum Payment Scheduler

A robust, scalable payment scheduler for the Circulum subscription platform built with Node.js, TypeScript, and MongoDB.

## Features

- **Automated Payment Processing**: Processes recurring subscription payments on schedule
- **Retry Logic**: Configurable retry attempts with exponential backoff
- **Grace Period**: Allows for temporary payment failures before cancellation
- **Batch Processing**: Processes payments in configurable batches to manage load
- **Comprehensive Logging**: Detailed logging with Winston for monitoring and debugging
- **Health Monitoring**: Built-in health checks and statistics
- **Docker Support**: Containerized deployment with Docker
- **Graceful Shutdown**: Handles SIGINT/SIGTERM for clean shutdowns

## Architecture

```
cron/
├── src/
│   ├── config/
│   │   └── database.ts          # Database connection management
│   ├── models/
│   │   ├── subscription.ts      # Subscription data model
│   │   └── plan.ts             # Plan data model
│   ├── services/
│   │   └── paymentProcessor.ts  # Core payment processing logic
│   ├── utils/
│   │   └── logger.ts           # Logging configuration
│   ├── scheduler.ts            # Main scheduler class
│   └── index.ts               # Entry point
├── Dockerfile                 # Container configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

## Installation

### Prerequisites

- Node.js 22+
- MongoDB
- Solana RPC endpoint
- TypeScript

### Local Development

1. **Install dependencies**:
   ```bash
   cd cron
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Run the scheduler**:
   ```bash
   npm start
   ```

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t circulum-scheduler .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name circulum-scheduler \
     --env-file .env \
     -v $(pwd)/logs:/app/logs \
     circulum-scheduler
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/circulum` |
| `SOLANA_NETWORK` | Solana network (devnet/testnet/mainnet) | `devnet` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | Auto-detected based on network |
| `PAYMENT_SCHEDULER_ENABLED` | Enable/disable scheduler | `true` |
| `PAYMENT_PROCESSING_INTERVAL` | Cron expression for processing | `*/5 * * * *` (every 5 minutes) |
| `PAYMENT_BATCH_SIZE` | Number of payments to process per batch | `50` |
| `PAYMENT_RETRY_ATTEMPTS` | Number of retry attempts for failed payments | `3` |
| `PAYMENT_RETRY_DELAY` | Delay between retries (ms) | `30000` |
| `PAYMENT_GRACE_PERIOD` | Grace period before cancellation (seconds) | `3600` |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | `info` |
| `LOG_FILE` | Log file path | `logs/payment-scheduler.log` |

### Cron Expression Examples

- `*/5 * * * *` - Every 5 minutes
- `0 */1 * * *` - Every hour
- `0 0 */1 * *` - Every day at midnight
- `0 0 * * 0` - Every Sunday at midnight

## Usage

### Running the Scheduler

The scheduler can be run in several ways:

1. **As a standalone service**:
   ```bash
   npm start
   ```

2. **In development mode with auto-reload**:
   ```bash
   npm run dev
   ```

3. **One-time payment processing**:
   ```bash
   npm run scheduler
   ```

### Monitoring

The scheduler provides comprehensive logging and statistics:

- **Log Files**: Located in `logs/` directory
- **Console Output**: Real-time logging in development
- **Statistics**: Payment processing metrics and health data

### Health Checks

The scheduler includes built-in health monitoring:

```typescript
const scheduler = new PaymentScheduler();
await scheduler.initialize();

// Get current status
const status = await scheduler.getStatus();
console.log(status);
// Output:
// {
//   isRunning: true,
//   nextRun: "2023-12-01T12:05:00.000Z",
//   stats: {
//     totalActive: 150,
//     dueForPayment: 12,
//     failedPayments: 3,
//     cancelledToday: 1
//   }
// }
```

## Payment Processing Flow

1. **Discovery**: Find all active subscriptions due for payment
2. **Batch Processing**: Process payments in configurable batches
3. **Retry Logic**: Retry failed payments with exponential backoff
4. **Grace Period**: Allow temporary failures before cancellation
5. **Status Updates**: Update subscription status and payment history
6. **Logging**: Record all activities for monitoring and debugging

## Error Handling

The scheduler includes comprehensive error handling:

- **Payment Failures**: Automatic retries with configurable attempts
- **Network Issues**: Graceful handling of Solana network problems
- **Database Errors**: Connection retry and error recovery
- **Graceful Shutdown**: Clean shutdown on SIGINT/SIGTERM signals

## Monitoring and Alerting

### Log Analysis

Monitor these log patterns for issues:

```bash
# Failed payments
grep "Payment attempt.*failed" logs/payment-scheduler.log

# Cancelled subscriptions
grep "cancelled due to.*failed payments" logs/payment-scheduler.log

# Database connection issues
grep "MongoDB connection error" logs/payment-scheduler.log
```

### Metrics to Monitor

- Payment success rate
- Average processing time
- Failed payment count
- Subscription cancellation rate
- Database connection health

## Development

### Adding New Features

1. **Payment Processors**: Extend `PaymentProcessor` class
2. **Notification Systems**: Add webhook or email notifications
3. **Custom Retry Logic**: Implement custom retry strategies
4. **Monitoring Integrations**: Add metrics collection

### Testing

```bash
# Run tests (when implemented)
npm test

# Type checking
npm run build

# Linting
npm run lint
```

## Deployment

### Production Considerations

1. **Resource Allocation**: Ensure adequate CPU and memory
2. **Database Connections**: Configure connection pooling
3. **Log Rotation**: Set up log rotation to prevent disk space issues
4. **Monitoring**: Implement application monitoring and alerting
5. **Backup Strategy**: Regular database backups
6. **Security**: Secure environment variables and network access

### Docker Compose Integration

Add to your `docker-compose.yml`:

```yaml
services:
  payment-scheduler:
    build: ./cron
    environment:
      - MONGODB_URI=mongodb://mongo:27017/circulum
      - SOLANA_NETWORK=devnet
      - PAYMENT_SCHEDULER_ENABLED=true
    volumes:
      - ./logs:/app/logs
    depends_on:
      - mongo
    restart: unless-stopped
```

## Troubleshooting

### Common Issues

1. **Scheduler Not Starting**:
   - Check environment variables
   - Verify database connectivity
   - Review logs for initialization errors

2. **Payment Failures**:
   - Verify Solana RPC endpoint
   - Check account balances
   - Review network connectivity

3. **High Memory Usage**:
   - Reduce batch size
   - Implement log rotation
   - Monitor database query performance

### Support

For issues and questions:
- Check the logs in `logs/` directory
- Review environment configuration
- Verify database and Solana connectivity
- Monitor system resources

## License

MIT License - see LICENSE file for details.
