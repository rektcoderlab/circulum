// MongoDB initialization script for Circulum
db = db.getSiblingDB('circulum');

// Create collections
db.createCollection('subscriptions');
db.createCollection('plans');
db.createCollection('payments');
db.createCollection('apikeys');
db.createCollection('webhooks');

// Create indexes for better performance
db.subscriptions.createIndex({ "subscriber": 1 });
db.subscriptions.createIndex({ "planId": 1 });
db.subscriptions.createIndex({ "status": 1 });
db.subscriptions.createIndex({ "nextPaymentDate": 1 });

db.plans.createIndex({ "creator": 1 });
db.plans.createIndex({ "isActive": 1 });

db.payments.createIndex({ "subscriptionId": 1 });
db.payments.createIndex({ "status": 1 });
db.payments.createIndex({ "createdAt": 1 });

db.apikeys.createIndex({ "keyHash": 1 }, { unique: true });
db.apikeys.createIndex({ "expiresAt": 1 });

db.webhooks.createIndex({ "url": 1 });
db.webhooks.createIndex({ "isActive": 1 });

// Insert sample test data for development
db.plans.insertMany([
  {
    _id: ObjectId(),
    name: "Basic Plan",
    description: "Basic subscription plan for testing",
    price: 1000000, // 0.001 SOL in lamports
    interval: "monthly",
    creator: "11111111111111111111111111111112", // System program ID for testing
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    name: "Premium Plan",
    description: "Premium subscription plan for testing",
    price: 5000000, // 0.005 SOL in lamports
    interval: "monthly",
    creator: "11111111111111111111111111111112",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('MongoDB initialization completed for Circulum project');
