# Docker and Solana Testnet Integration Guide

This guide explains how to set up and use the Docker environment with Solana testnet integration for the Circulum project.

## Overview

The Docker setup provides a complete development and testing environment that includes:

- **MongoDB**: Database for storing subscription data
- **Solana Development Environment**: Container with Solana CLI, Anchor, and Rust
- **API Service**: Express.js API server
- **Test Runner**: Automated testing environment

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- At least 4GB of available RAM
- Internet connection for downloading images and testnet access

### Automated Setup

Run the automated setup script:

```bash
./scripts/setup-testnet.sh
```

This script will:
1. Check Docker installation
2. Generate Solana keypairs
3. Set up environment files
4. Build Docker images
5. Start all services
6. Configure Solana for testnet
7. Request SOL airdrop for testing
8. Optionally run the test suite

### Manual Setup

If you prefer manual setup:

1. **Copy environment files:**
   ```bash
   cp .env.testnet .env
   cp api/.env.example api/.env
   ```

2. **Build Docker images:**
   ```bash
   docker build -f Dockerfile.solana -t circulum-solana:latest .
   docker build -f api/Dockerfile -t circulum-api:latest ./api
   ```

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

4. **Generate keypairs (if needed):**
   ```bash
   docker-compose exec solana-dev solana-keygen new --no-bip39-passphrase --outfile /workspace/keys/test-keypair.json
   ```

5. **Request testnet SOL:**
   ```bash
   docker-compose exec solana-dev solana airdrop 2
   ```

## Services

### MongoDB
- **Port**: 27017
- **Database**: circulum
- **Credentials**: admin/password123
- **Connection String**: `mongodb://admin:password123@localhost:27017/circulum?authSource=admin`

### API Service
- **Port**: 3000
- **Health Check**: http://localhost:3000/health
- **Environment**: Development with debug logging

### Solana Development Environment
- **Network**: Testnet (https://api.testnet.solana.com)
- **Keypair Location**: `/workspace/keys/test-keypair.json`
- **Program ID**: `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS`

## Common Commands

### Service Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f solana-dev

# Restart a service
docker-compose restart api
```

### Development Commands

```bash
# Access Solana development container
docker-compose exec solana-dev bash

# Run tests
docker-compose --profile testing run --rm test-runner

# Build Anchor program
docker-compose exec solana-dev anchor build

# Deploy to testnet
docker-compose exec solana-dev anchor deploy --provider.cluster testnet

# Check Solana configuration
docker-compose exec solana-dev solana config get

# Check wallet balance
docker-compose exec solana-dev solana balance

# Request SOL airdrop
docker-compose exec solana-dev solana airdrop 2
```

### API Development

```bash
# Access API container
docker-compose exec api bash

# View API logs
docker-compose logs -f api

# Restart API with new code (if volume mounted)
docker-compose restart api
```

## Environment Configuration

### Testnet Configuration (.env.testnet)

Key environment variables for testnet:

```bash
# Solana Configuration
SOLANA_RPC_URL=https://api.testnet.solana.com
SOLANA_NETWORK=testnet
ANCHOR_PROVIDER_URL=https://api.testnet.solana.com
ANCHOR_WALLET=./keys/test-keypair.json

# Program Configuration
PROGRAM_ID=Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/circulum?authSource=admin

# Testing
TEST_TIMEOUT=120000
ENABLE_AIRDROP=true
AIRDROP_AMOUNT=1000000000
```

### Docker Compose Profiles

The setup uses Docker Compose profiles for different scenarios:

- **Default**: Core services (MongoDB, Solana dev, API)
- **Testing**: Includes test runner service

```bash
# Run with testing profile
docker-compose --profile testing up -d

# Run tests only
docker-compose --profile testing run --rm test-runner
```

## Keypair Management

### Location
All keypairs are stored in the `./keys/` directory and mounted into containers.

### Important Files
- `test-keypair.json`: Main test wallet
- `program-keypair.json`: Program deployment key
- `authority-keypair.json`: Program authority key (if needed)

### Security Notes
- Never commit real keypairs with funds to version control
- The `keys/` directory is gitignored except for `.gitkeep`
- Use only testnet SOL for development

### Generating New Keypairs

```bash
# Generate new test keypair
docker-compose exec solana-dev solana-keygen new --no-bip39-passphrase --outfile /workspace/keys/new-keypair.json

# Or locally if Solana CLI is installed
solana-keygen new --no-bip39-passphrase --outfile keys/new-keypair.json
```

## Testing

### Running Tests

```bash
# Run all tests
docker-compose --profile testing run --rm test-runner

# Run specific test file
docker-compose exec solana-dev npm test -- tests/specific-test.ts

# Run tests with verbose output
docker-compose exec solana-dev npm test -- --verbose
```

### Test Environment

The test environment includes:
- Fresh MongoDB database with sample data
- Testnet connection with funded test wallet
- All API services running
- Proper environment variables set

## Troubleshooting

### Common Issues

1. **Services won't start**
   ```bash
   # Check Docker daemon
   docker info
   
   # Check logs
   docker-compose logs
   
   # Rebuild images
   docker-compose build --no-cache
   ```

2. **Solana connection issues**
   ```bash
   # Check testnet status
   curl -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1, "method":"getHealth"}' https://api.testnet.solana.com
   
   # Verify configuration
   docker-compose exec solana-dev solana config get
   ```

3. **Database connection issues**
   ```bash
   # Check MongoDB logs
   docker-compose logs mongodb
   
   # Test connection
   docker-compose exec mongodb mongosh --username admin --password password123 --authenticationDatabase admin
   ```

4. **Out of testnet SOL**
   ```bash
   # Request more SOL
   docker-compose exec solana-dev solana airdrop 2
   
   # Check balance
   docker-compose exec solana-dev solana balance
   ```

### Performance Optimization

1. **Increase Docker resources** (recommended: 4GB RAM, 2 CPU cores)
2. **Use Docker volumes** for persistent data
3. **Prune unused images** regularly:
   ```bash
   docker system prune -a
   ```

### Logs and Debugging

```bash
# View all logs
docker-compose logs -f

# View logs for specific timeframe
docker-compose logs --since 30m

# Export logs to file
docker-compose logs > debug.log
```

## Production Considerations

### Security
- Use proper secrets management
- Implement proper authentication
- Use production-grade MongoDB setup
- Secure keypair storage

### Scaling
- Use Docker Swarm or Kubernetes for orchestration
- Implement load balancing for API
- Use MongoDB replica sets
- Monitor resource usage

### Monitoring
- Implement health checks
- Set up logging aggregation
- Monitor Solana network status
- Track API performance metrics

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Solana Documentation](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [MongoDB Docker](https://hub.docker.com/_/mongo)

## Support

For issues related to the Docker setup:
1. Check the troubleshooting section above
2. Review Docker and service logs
3. Ensure all prerequisites are met
4. Check network connectivity to Solana testnet
