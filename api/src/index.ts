import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { CirculumService } from '@core/services/circulum.service';
import { subscriptionRoutes } from './routes/subscriptions';
import { planRoutes } from './routes/plans';
import { paymentRoutes } from './routes/payments';
import { integrationRoutes } from './routes/integration';
import { logger } from '@core/utils/logger';
import { errorHandler } from './middleware/error-handler';
import { rateLimiter } from './middleware/rate-limiter';
import { database } from './utils/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0'
  });
});

// API routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/integration', integrationRoutes);

// Error handling
app.use(errorHandler);

// Initialize database, Solana connection and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await database.connect();
    logger.info('Database connection established');

    // Initialize Solana connection
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Initialize wallet (in production, use proper key management)
    const wallet = new Wallet(Keypair.generate());
    
    // Initialize Anchor provider
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    // Initialize Circulum service
    const circulumService = new CirculumService(provider);
    
    // Make service available to routes
    app.locals.circulumService = circulumService;
    app.locals.connection = connection;

    app.listen(PORT, () => {
      logger.info(`Circulum API server running on port ${PORT}`);
      logger.info(`Solana network: ${process.env.SOLANA_RPC_URL || 'devnet'}`);
      logger.info(`MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/circulum'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
