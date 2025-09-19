# Circulum Deployment Guide

This guide covers how to deploy the Circulum decentralized subscription management system to various environments.

## Prerequisites

Before deploying Circulum, ensure you have the following installed:

- **Rust** (latest stable version)
- **Solana CLI** (v1.16.0 or later)
- **Anchor Framework** (v0.29.0 or later)
- **Node.js** (v22.0.0 or later)
- **npm** or **yarn**

## Environment Setup

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
```

### 2. Install Anchor

```bash
npm install -g @coral-xyz/anchor-cli
```

### 3. Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install
```

## Local Development

### 1. Start Local Solana Validator

```bash
solana-test-validator
```

### 2. Configure Solana CLI

```bash
# Set to localhost
solana config set --url localhost

# Create a keypair (if you don't have one)
solana-keygen new --outfile ~/.config/solana/id.json

# Airdrop SOL for testing
solana airdrop 2
```

### 3. Build and Deploy Smart Contract

```bash
# Build the program
anchor build

# Deploy to local validator
anchor deploy
```

### 4. Run Tests

```bash
# Run smart contract tests
anchor test

# Run API tests (if implemented)
cd api && npm test
```

### 5. Start API Server

```bash
# Copy environment file
cp api/.env.example api/.env

# Start development server
cd api && npm run dev
```

The API will be available at `http://localhost:3000`

## Devnet Deployment

### 1. Configure for Devnet

```bash
# Set Solana CLI to devnet
solana config set --url devnet

# Airdrop SOL for deployment
solana airdrop 2
```

### 2. Update Program ID

After building, update the program ID in:
- `Anchor.toml`
- `programs/circulum/src/lib.rs` (declare_id! macro)

### 3. Deploy to Devnet

```bash
# Build with updated program ID
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### 4. Update API Configuration

Update `api/.env`:
```env
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
```

### 5. Deploy API Server

You can deploy the API server to various platforms:

#### Heroku Deployment

1. Create a Heroku app:
```bash
heroku create your-circulum-api
```

2. Set environment variables:
```bash
heroku config:set NODE_ENV=production
heroku config:set SOLANA_RPC_URL=https://api.devnet.solana.com
heroku config:set SOLANA_NETWORK=devnet
```

3. Deploy:
```bash
git subtree push --prefix api heroku main
```

#### Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

#### DigitalOcean App Platform

1. Create a new app from your GitHub repository
2. Configure build and run commands:
   - Build: `cd api && npm install && npm run build`
   - Run: `cd api && npm start`
3. Set environment variables

## Mainnet Deployment

⚠️ **Warning**: Mainnet deployment involves real SOL. Ensure thorough testing on devnet first.

### 1. Security Considerations

- Use a secure keypair management system
- Implement proper access controls
- Audit your smart contract code
- Set up monitoring and alerting

### 2. Configure for Mainnet

```bash
# Set Solana CLI to mainnet
solana config set --url mainnet-beta

# Use a secure keypair (not the default one)
solana config set --keypair /path/to/secure/keypair.json
```

### 3. Deploy Smart Contract

```bash
# Update program ID for mainnet in Anchor.toml and lib.rs
anchor build
anchor deploy --provider.cluster mainnet-beta
```

### 4. Production API Deployment

#### Environment Variables

```env
NODE_ENV=production
PORT=3000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_NETWORK=mainnet-beta
LOG_LEVEL=info
RATE_LIMIT_POINTS=100
RATE_LIMIT_DURATION=60
```

#### Docker Deployment

Create `api/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
cd api
docker build -t circulum-api .
docker run -p 3000:3000 --env-file .env circulum-api
```

#### Kubernetes Deployment

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: circulum-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: circulum-api
  template:
    metadata:
      labels:
        app: circulum-api
    spec:
      containers:
      - name: circulum-api
        image: your-registry/circulum-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: SOLANA_RPC_URL
          value: "https://api.mainnet-beta.solana.com"
---
apiVersion: v1
kind: Service
metadata:
  name: circulum-api-service
spec:
  selector:
    app: circulum-api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Monitoring and Maintenance

### 1. Health Checks

The API includes a health check endpoint at `/health`. Use this for:
- Load balancer health checks
- Monitoring systems
- Uptime monitoring

### 2. Logging

Configure structured logging:
```env
LOG_LEVEL=info
```

Logs are written to:
- Console (development)
- Files in `logs/` directory (production)

### 3. Metrics

Consider implementing metrics collection:
- Request/response times
- Error rates
- Subscription creation rates
- Payment processing success rates

### 4. Database Considerations

While Circulum stores data on-chain, you might want to implement:
- Caching layer (Redis)
- Analytics database
- Event indexing

## Security Best Practices

### 1. Smart Contract Security

- Implement proper access controls
- Validate all inputs
- Use secure random number generation
- Implement emergency pause functionality
- Regular security audits

### 2. API Security

- Implement rate limiting (already included)
- Use HTTPS in production
- Implement proper CORS policies
- Add request validation
- Implement authentication/authorization
- Regular dependency updates

### 3. Infrastructure Security

- Use secure keypair storage (AWS KMS, HashiCorp Vault)
- Implement network security groups
- Regular security updates
- Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **Program deployment fails**
   - Check SOL balance for deployment fees
   - Verify program ID matches in all files
   - Ensure Anchor version compatibility

2. **API connection issues**
   - Verify RPC URL is accessible
   - Check network connectivity
   - Validate environment variables

3. **Transaction failures**
   - Check account balances
   - Verify account permissions
   - Review transaction logs

### Debug Commands

```bash
# Check program logs
solana logs <program-id>

# Get program account info
solana account <program-id>

# Check transaction details
solana confirm <transaction-signature>
```

## Performance Optimization

### 1. RPC Optimization

- Use dedicated RPC providers for production
- Implement connection pooling
- Cache frequently accessed data

### 2. API Optimization

- Implement response caching
- Use compression middleware
- Optimize database queries
- Implement pagination

### 3. Smart Contract Optimization

- Minimize account data size
- Optimize instruction data
- Use efficient data structures
- Batch operations when possible

## Backup and Recovery

### 1. Smart Contract

- Smart contracts are immutable once deployed
- Keep deployment artifacts and build files
- Document upgrade procedures if using upgradeable programs

### 2. API Data

- Backup configuration files
- Document environment setup
- Keep deployment scripts versioned

## Support and Maintenance

### 1. Updates

- Monitor Solana network updates
- Keep dependencies updated
- Test updates on devnet first

### 2. Monitoring

- Set up alerts for critical failures
- Monitor transaction success rates
- Track API performance metrics

### 3. Documentation

- Keep deployment documentation updated
- Document any custom configurations
- Maintain runbooks for common operations
