# Circulum - Decentralized Subscription Manager

A Solana-based smart contract system that automates recurring payments in SOL/SPL tokens for creators, SaaS products, and NFT communities.

## ⚠️ IMPORTANT DISCLAIMER

**This project is NOT production-ready and is provided for development and testing purposes only.**

Before using in production, you must:
- Implement proper private key management and transaction signing
- Add comprehensive security measures and access controls
- Implement proper error handling for all edge cases
- Add extensive testing (unit, integration, and load tests)
- Set up proper monitoring, alerting, and observability
- Implement proper backup and disaster recovery procedures
- Conduct thorough security audits and penetration testing
- Add rate limiting and DDoS protection
- Implement proper database indexing and query optimization
- Add proper input validation and sanitization

**Use at your own risk. The authors are not responsible for any financial losses or security breaches.**

## Features

- **Automated Recurring Payments**: Set up subscriptions with customizable intervals
- **Payment Scheduler**: Built-in cron service for processing recurring payments
- **Multi-Token Support**: Accept payments in SOL and SPL tokens
- **Creator-Friendly**: Built for content creators, SaaS providers, and NFT communities
- **Decentralized**: No intermediaries, direct creator-subscriber relationships
- **Flexible Plans**: Multiple subscription tiers and pricing options
- **Retry Logic**: Configurable retry attempts with exponential backoff for failed payments
- **Grace Periods**: Allow temporary payment failures before subscription cancellation
- **Comprehensive Monitoring**: Built-in logging, health checks, and payment statistics

## Project Structure

```
Circulum/
├── programs/          # Solana smart contracts
│   └── circulum/      # Main subscription contract
├── api/               # Backend API for frontend integration
├── cron/              # Payment scheduler service
├── cli/               # Command-line tools
├── tests/             # Contract and API tests
├── scripts/           # Deployment scripts
├── docker/            # Docker init scripts
└── docs/              # Documentation
```

## Quick Start

### Prerequisites

- Docker and Docker Compose (recommended)
- OR: Rust, Solana CLI, Anchor framework, Node.js

### Docker Setup (Recommended)

The fastest way to get started with Circulum is using Docker:

```bash
# Run the automated setup script
./scripts/setup-testnet.sh

# Or manually:
docker-compose up -d
```

This will start:
- MongoDB database
- Solana testnet development environment
- API server on http://localhost:3000
- Automated testnet SOL airdrop

See [Docker and Testnet Guide](docs/DOCKER_TESTNET.md) for detailed instructions.

### Manual Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the contract: `anchor build`
4. Run tests: `anchor test`
5. Start API server: `cd api && npm start`

### Testing Environment

The project includes a complete Docker-based testing environment with:
- Solana testnet integration
- MongoDB database with sample data
- API server with health checks
- Automated test runner

```bash
# Run all tests in Docker
docker-compose --profile testing run --rm test-runner

# Or run tests locally
npm test
```

## Architecture

The Circulum system consists of:

1. **Subscription Contract**: Core smart contract handling subscription logic
2. **Payment Processor**: Handles SOL and SPL token transfers
3. **Plan Manager**: Manages subscription plans and pricing
4. **API Layer**: RESTful API for frontend integration
5. **Payment Scheduler**: Automated cron service for processing recurring payments

### Payment Scheduler Service

The `cron/` directory contains a robust payment scheduler service that:

- **Processes Recurring Payments**: Automatically processes due subscription payments on configurable schedules
- **Handles Payment Failures**: Implements retry logic with exponential backoff and grace periods
- **Batch Processing**: Processes payments in configurable batches to manage system load
- **Comprehensive Logging**: Provides detailed logging and monitoring capabilities
- **Docker Support**: Includes containerization for easy deployment

To run the payment scheduler:

```bash
# Install dependencies
cd cron && npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run the scheduler
npm start

# Or run with Docker
docker build -t circulum-scheduler .
docker run --env-file .env circulum-scheduler
```

See [cron/README.md](cron/README.md) for detailed documentation on the payment scheduler service.

## License

MIT License
