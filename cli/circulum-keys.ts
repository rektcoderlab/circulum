#!/usr/bin/env node

import { Command } from 'commander';
import mongoose from 'mongoose';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { config } from 'dotenv';
import { apiKeyService, CreateApiKeyData } from '../api/src/services/api-key.service';

// Load environment variables
config({ path: '../api/.env' });

const program = new Command();

// Available permissions
const AVAILABLE_PERMISSIONS = [
  'plans:read',
  'plans:write',
  'subscriptions:read',
  'subscriptions:write',
  'payments:read',
  'payments:write',
  'webhooks:read',
  'webhooks:write',
  'integration:read',
  'admin:read',
  'admin:write',
];

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/circulum';
    await mongoose.connect(mongoUri);
    console.log(chalk.green('✓ Connected to MongoDB'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to connect to MongoDB:'), error);
    process.exit(1);
  }
}

// Disconnect from MongoDB
async function disconnectDB() {
  await mongoose.disconnect();
}

// Format date for display
function formatDate(date?: Date): string {
  if (!date) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Create API key command
program
  .command('create')
  .description('Create a new API key')
  .option('-n, --name <name>', 'API key name')
  .option('-p, --permissions <permissions>', 'Comma-separated list of permissions')
  .option('-r, --rate-limit <limit>', 'Rate limit (requests per minute)', '1000')
  .option('-e, --environment <env>', 'Environment (development, staging, production)', 'development')
  .option('-d, --description <description>', 'API key description')
  .option('--expires <date>', 'Expiration date (YYYY-MM-DD)')
  .option('--created-by <creator>', 'Creator identifier')
  .option('--interactive', 'Interactive mode')
  .action(async (options) => {
    await connectDB();

    try {
      let keyData: CreateApiKeyData;

      if (options.interactive) {
        // Interactive mode
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'API key name:',
            validate: (input) => input.length > 0 || 'Name is required',
          },
          {
            type: 'checkbox',
            name: 'permissions',
            message: 'Select permissions:',
            choices: AVAILABLE_PERMISSIONS,
            validate: (input) => input.length > 0 || 'At least one permission is required',
          },
          {
            type: 'number',
            name: 'rateLimit',
            message: 'Rate limit (requests per minute):',
            default: 1000,
            validate: (input) => input > 0 || 'Rate limit must be positive',
          },
          {
            type: 'list',
            name: 'environment',
            message: 'Environment:',
            choices: ['development', 'staging', 'production'],
            default: 'development',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
          },
          {
            type: 'input',
            name: 'createdBy',
            message: 'Created by (optional):',
          },
        ]);

        keyData = {
          name: answers.name,
          permissions: answers.permissions,
          rateLimit: answers.rateLimit,
          createdBy: answers.createdBy || undefined,
          metadata: {
            environment: answers.environment,
            description: answers.description || undefined,
          },
        };
      } else {
        // Command line mode
        if (!options.name) {
          console.error(chalk.red('✗ API key name is required'));
          process.exit(1);
        }

        if (!options.permissions) {
          console.error(chalk.red('✗ Permissions are required'));
          process.exit(1);
        }

        const permissions = options.permissions.split(',').map((p: string) => p.trim());
        const invalidPermissions = permissions.filter((p: string) => !AVAILABLE_PERMISSIONS.includes(p));
        
        if (invalidPermissions.length > 0) {
          console.error(chalk.red(`✗ Invalid permissions: ${invalidPermissions.join(', ')}`));
          console.log(chalk.yellow('Available permissions:'), AVAILABLE_PERMISSIONS.join(', '));
          process.exit(1);
        }

        keyData = {
          name: options.name,
          permissions,
          rateLimit: parseInt(options.rateLimit),
          createdBy: options.createdBy,
          metadata: {
            environment: options.environment,
            description: options.description,
            expiresAt: options.expires ? new Date(options.expires) : undefined,
          },
        };
      }

      const { apiKey, rawKey } = await apiKeyService.createApiKey(keyData);

      console.log(chalk.green('\n✓ API key created successfully!'));
      console.log(chalk.yellow('\n⚠️  Store this key securely - it will not be shown again:'));
      console.log(chalk.cyan(`\n${rawKey}\n`));

      const table = new Table({
        head: ['Property', 'Value'],
        colWidths: [20, 50],
      });

      table.push(
        ['ID', apiKey._id.toString()],
        ['Name', apiKey.name],
        ['Permissions', apiKey.permissions.join(', ')],
        ['Rate Limit', `${apiKey.rateLimit}/min`],
        ['Environment', apiKey.metadata?.environment || 'development'],
        ['Created At', formatDate(apiKey.createdAt)]
      );

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('✗ Failed to create API key:'), error);
    } finally {
      await disconnectDB();
    }
  });

// List API keys command
program
  .command('list')
  .description('List all API keys')
  .option('-a, --active-only', 'Show only active keys')
  .option('-e, --environment <env>', 'Filter by environment')
  .option('--created-by <creator>', 'Filter by creator')
  .action(async (options) => {
    await connectDB();

    try {
      const filters: any = {};
      
      if (options.activeOnly) {
        filters.isActive = true;
      }
      
      if (options.environment) {
        filters.environment = options.environment;
      }
      
      if (options.createdBy) {
        filters.createdBy = options.createdBy;
      }

      const apiKeys = await apiKeyService.getAllApiKeys(filters);

      if (apiKeys.length === 0) {
        console.log(chalk.yellow('No API keys found'));
        return;
      }

      const table = new Table({
        head: ['ID', 'Name', 'Status', 'Permissions', 'Rate Limit', 'Usage', 'Last Used', 'Created'],
        colWidths: [25, 20, 10, 30, 12, 10, 15, 15],
      });

      apiKeys.forEach(key => {
        table.push([
          key.id.substring(0, 20) + '...',
          key.name,
          key.isActive ? chalk.green('Active') : chalk.red('Inactive'),
          key.permissions.slice(0, 2).join(', ') + (key.permissions.length > 2 ? '...' : ''),
          `${key.rateLimit}/min`,
          key.usageCount.toString(),
          formatDate(key.lastUsed),
          formatDate(key.createdAt),
        ]);
      });

      console.log(`\n${chalk.blue('API Keys')} (${apiKeys.length} total)\n`);
      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('✗ Failed to list API keys:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Show API key details command
program
  .command('show <id>')
  .description('Show detailed information about an API key')
  .action(async (id) => {
    await connectDB();

    try {
      const apiKey = await apiKeyService.getApiKeyById(id);

      if (!apiKey) {
        console.error(chalk.red('✗ API key not found'));
        process.exit(1);
      }

      console.log(chalk.blue(`\nAPI Key Details: ${apiKey.name}\n`));

      const table = new Table({
        head: ['Property', 'Value'],
        colWidths: [20, 60],
      });

      table.push(
        ['ID', apiKey.id],
        ['Name', apiKey.name],
        ['Status', apiKey.isActive ? chalk.green('Active') : chalk.red('Inactive')],
        ['Permissions', apiKey.permissions.join(', ')],
        ['Rate Limit', `${apiKey.rateLimit} requests/minute`],
        ['Usage Count', apiKey.usageCount.toString()],
        ['Environment', apiKey.metadata?.environment || 'development'],
        ['Description', apiKey.metadata?.description || 'None'],
        ['Created By', apiKey.createdBy || 'Unknown'],
        ['Created At', formatDate(apiKey.createdAt)],
        ['Last Used', formatDate(apiKey.lastUsed)],
        ['Expires At', apiKey.metadata?.expiresAt ? formatDate(apiKey.metadata.expiresAt) : 'Never']
      );

      console.log(table.toString());
    } catch (error) {
      console.error(chalk.red('✗ Failed to show API key:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Deactivate API key command
program
  .command('deactivate <id>')
  .description('Deactivate an API key')
  .action(async (id) => {
    await connectDB();

    try {
      const apiKey = await apiKeyService.getApiKeyById(id);
      
      if (!apiKey) {
        console.error(chalk.red('✗ API key not found'));
        process.exit(1);
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to deactivate "${apiKey.name}"?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }

      const success = await apiKeyService.deactivateApiKey(id);
      
      if (success) {
        console.log(chalk.green('✓ API key deactivated successfully'));
      } else {
        console.error(chalk.red('✗ Failed to deactivate API key'));
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to deactivate API key:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Delete API key command
program
  .command('delete <id>')
  .description('Permanently delete an API key')
  .action(async (id) => {
    await connectDB();

    try {
      const apiKey = await apiKeyService.getApiKeyById(id);
      
      if (!apiKey) {
        console.error(chalk.red('✗ API key not found'));
        process.exit(1);
      }

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to permanently delete "${apiKey.name}"? This action cannot be undone.`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }

      const success = await apiKeyService.deleteApiKey(id);
      
      if (success) {
        console.log(chalk.green('✓ API key deleted successfully'));
      } else {
        console.error(chalk.red('✗ Failed to delete API key'));
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to delete API key:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Stats command
program
  .command('stats')
  .description('Show API key usage statistics')
  .action(async () => {
    await connectDB();

    try {
      const stats = await apiKeyService.getUsageStats();

      console.log(chalk.blue('\nAPI Key Statistics\n'));

      const summaryTable = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 15],
      });

      summaryTable.push(
        ['Total Keys', stats.totalKeys.toString()],
        ['Active Keys', stats.activeKeys.toString()],
        ['Total Usage', stats.totalUsage.toString()]
      );

      console.log(summaryTable.toString());

      if (Object.keys(stats.keysByEnvironment).length > 0) {
        console.log(chalk.blue('\nKeys by Environment\n'));
        
        const envTable = new Table({
          head: ['Environment', 'Count'],
          colWidths: [20, 10],
        });

        Object.entries(stats.keysByEnvironment).forEach(([env, count]) => {
          envTable.push([env, count.toString()]);
        });

        console.log(envTable.toString());
      }

      if (stats.topKeys.length > 0) {
        console.log(chalk.blue('\nTop Used Keys\n'));
        
        const topTable = new Table({
          head: ['Name', 'Usage Count', 'Last Used'],
          colWidths: [25, 15, 20],
        });

        stats.topKeys.forEach(key => {
          topTable.push([
            key.name,
            key.usageCount.toString(),
            formatDate(key.lastUsed),
          ]);
        });

        console.log(topTable.toString());
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to get statistics:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Cleanup expired keys command
program
  .command('cleanup')
  .description('Deactivate expired API keys')
  .action(async () => {
    await connectDB();

    try {
      const count = await apiKeyService.cleanupExpiredKeys();
      
      if (count > 0) {
        console.log(chalk.green(`✓ Deactivated ${count} expired API keys`));
      } else {
        console.log(chalk.yellow('No expired API keys found'));
      }
    } catch (error) {
      console.error(chalk.red('✗ Failed to cleanup expired keys:'), error);
    } finally {
      await disconnectDB();
    }
  });

// Configure program
program
  .name('circulum-keys')
  .description('Circulum API Key Management CLI')
  .version('1.0.0');

// Parse command line arguments
program.parse();
