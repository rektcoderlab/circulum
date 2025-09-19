# Circulum CLI Tool Documentation

The Circulum CLI tool (`circulum-keys`) provides comprehensive API key management capabilities for the Circulum decentralized subscription management system. It connects directly to MongoDB to manage API keys securely.

## Installation

### Prerequisites

- Node.js (v18.0.0 or later)
- MongoDB (local or remote instance)
- TypeScript (for development)

### Install Dependencies

```bash
cd cli
npm install
```

### Build the CLI

```bash
npm run build
```

### Install Globally (Optional)

```bash
npm run install-global
```

After global installation, you can use `circulum-keys` from anywhere.

## Configuration

The CLI uses environment variables for configuration. Create a `.env` file in the `api` directory:

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/circulum

# Optional: Logging
LOG_LEVEL=info
```

## Commands

### `create` - Create API Key

Create a new API key with specified permissions and settings.

#### Interactive Mode

```bash
circulum-keys create --interactive
```

This will prompt you for all required information:
- API key name
- Permissions (checkbox selection)
- Rate limit
- Environment
- Description
- Creator identifier

#### Command Line Mode

```bash
circulum-keys create \
  --name "Production Integration" \
  --permissions "plans:read,plans:write,subscriptions:read,subscriptions:write" \
  --rate-limit 5000 \
  --environment production \
  --description "Main production API key" \
  --created-by "admin@company.com"
```

#### Options

- `-n, --name <name>` - API key name (required)
- `-p, --permissions <permissions>` - Comma-separated permissions (required)
- `-r, --rate-limit <limit>` - Rate limit in requests per minute (default: 1000)
- `-e, --environment <env>` - Environment: development, staging, production (default: development)
- `-d, --description <description>` - API key description
- `--expires <date>` - Expiration date (YYYY-MM-DD format)
- `--created-by <creator>` - Creator identifier
- `--interactive` - Use interactive mode

#### Available Permissions

- `plans:read` - Read subscription plans
- `plans:write` - Create and modify subscription plans
- `subscriptions:read` - Read subscription data
- `subscriptions:write` - Create and modify subscriptions
- `payments:read` - Read payment data
- `payments:write` - Process payments
- `webhooks:read` - Read webhook configurations
- `webhooks:write` - Create and modify webhooks
- `integration:read` - Read integration data
- `admin:read` - Administrative read access
- `admin:write` - Administrative write access

#### Example Output

```
✓ Connected to MongoDB

✓ API key created successfully!

⚠️  Store this key securely - it will not be shown again:

sk_li....p6q7r8s9t0

┌──────────────┬──────────────────────────────────────────────────┐
│ Property     │ Value                                            │
├──────────────┼──────────────────────────────────────────────────┤
│ ID           │ 507f1f77bcf86cd799439011                         │
│ Name         │ Production Integration                           │
│ Permissions  │ plans:read, plans:write, subscriptions:read...   │
│ Rate Limit   │ 5000/min                                         │
│ Environment  │ production                                       │
│ Created At   │ Dec 1, 2023, 10:30 AM                          │
└──────────────┴──────────────────────────────────────────────────┘
```

### `list` - List API Keys

Display all API keys with their status and usage information.

```bash
circulum-keys list
```

#### Options

- `-a, --active-only` - Show only active keys
- `-e, --environment <env>` - Filter by environment
- `--created-by <creator>` - Filter by creator

#### Example Output

```
API Keys (3 total)

┌─────────────────────────┬──────────────────────┬────────────┬────────────────────────────────┬──────────────┬────────┬─────────────────┬─────────────────┐
│ ID                      │ Name                 │ Status     │ Permissions                    │ Rate Limit   │ Usage  │ Last Used       │ Created         │
├─────────────────────────┼──────────────────────┼────────────┼────────────────────────────────┼──────────────┼────────┼─────────────────┼─────────────────┤
│ 507f1f77bcf86cd79943... │ Production API       │ Active     │ plans:read, plans:write...     │ 5000/min     │ 1250   │ Dec 1, 10:25 AM │ Nov 28, 2:15 PM │
│ 507f1f77bcf86cd79944... │ Development Test     │ Active     │ plans:read, subscriptions:read │ 1000/min     │ 45     │ Nov 30, 4:20 PM │ Nov 29, 9:30 AM │
│ 507f1f77bcf86cd79945... │ Legacy Integration   │ Inactive   │ plans:read                     │ 500/min      │ 0      │ Never           │ Nov 15, 1:45 PM │
└─────────────────────────┴──────────────────────┴────────────┴────────────────────────────────┴──────────────┴────────┴─────────────────┴─────────────────┘
```

### `show` - Show API Key Details

Display detailed information about a specific API key.

```bash
circulum-keys show 507f1f77bcf86cd799439011
```

#### Example Output

```
API Key Details: Production Integration

┌──────────────┬────────────────────────────────────────────────────────────┐
│ Property     │ Value                                                      │
├──────────────┼────────────────────────────────────────────────────────────┤
│ ID           │ 507f1f77bcf86cd799439011                                   │
│ Name         │ Production Integration                                     │
│ Status       │ Active                                                     │
│ Permissions  │ plans:read, plans:write, subscriptions:read, payments:read │
│ Rate Limit   │ 5000 requests/minute                                       │
│ Usage Count  │ 1250                                                       │
│ Environment  │ production                                                 │
│ Description  │ Main production API key for external integrations         │
│ Created By   │ admin@company.com                                          │
│ Created At   │ Nov 28, 2023, 2:15 PM                                     │
│ Last Used    │ Dec 1, 2023, 10:25 AM                                     │
│ Expires At   │ Never                                                      │
└──────────────┴────────────────────────────────────────────────────────────┘
```

### `deactivate` - Deactivate API Key

Deactivate an API key (can be reactivated later).

```bash
circulum-keys deactivate 507f1f77bcf86cd799439011
```

The command will ask for confirmation before deactivating the key.

### `delete` - Delete API Key

Permanently delete an API key (cannot be undone).

```bash
circulum-keys delete 507f1f77bcf86cd799439011
```

The command will ask for confirmation before permanently deleting the key.

### `stats` - Usage Statistics

Display comprehensive usage statistics for all API keys.

```bash
circulum-keys stats
```

#### Example Output

```
API Key Statistics

┌─────────────────────────┬─────────┐
│ Metric                  │ Value   │
├─────────────────────────┼─────────┤
│ Total Keys              │ 15      │
│ Active Keys             │ 12      │
│ Total Usage             │ 45230   │
└─────────────────────────┴─────────┘

Keys by Environment

┌──────────────┬───────┐
│ Environment  │ Count │
├──────────────┼───────┤
│ production   │ 5     │
│ development  │ 8     │
│ staging      │ 2     │
└──────────────┴───────┘

Top Used Keys

┌─────────────────────────┬─────────────┬─────────────────────┐
│ Name                    │ Usage Count │ Last Used           │
├─────────────────────────┼─────────────┼─────────────────────┤
│ Production API          │ 15420       │ Dec 1, 2023, 10:25 │
│ Mobile App Integration  │ 8930        │ Dec 1, 2023, 9:15  │
│ Dashboard Backend       │ 5670        │ Nov 30, 2023, 11:45│
└─────────────────────────┴─────────────┴─────────────────────┘
```

### `cleanup` - Clean Up Expired Keys

Automatically deactivate expired API keys.

```bash
circulum-keys cleanup
```

This command will:
- Find all API keys with expiration dates in the past
- Deactivate them automatically
- Report the number of keys cleaned up

## Usage Examples

### Creating a Development API Key

```bash
circulum-keys create \
  --name "Local Development" \
  --permissions "plans:read,plans:write,subscriptions:read" \
  --rate-limit 1000 \
  --environment development \
  --description "For local development and testing"
```

### Creating a Production API Key with Expiration

```bash
circulum-keys create \
  --name "Partner Integration" \
  --permissions "plans:read,subscriptions:read,payments:read" \
  --rate-limit 10000 \
  --environment production \
  --expires "2024-12-31" \
  --created-by "partnerships@company.com" \
  --description "API key for partner XYZ integration"
```

### Listing Only Active Production Keys

```bash
circulum-keys list --active-only --environment production
```

### Interactive Key Creation

```bash
circulum-keys create --interactive
```

This will guide you through the process with prompts:

```
? API key name: Customer Portal API
? Select permissions: (Use arrow keys and space to select)
❯◉ plans:read
 ◉ subscriptions:read
 ◉ subscriptions:write
 ◯ payments:read
 ◯ payments:write
 ◯ webhooks:read
 ◯ webhooks:write

? Rate limit (requests per minute): 2000
? Environment: (Use arrow keys)
❯ development
  staging
  production

? Description (optional): API key for customer portal backend
? Created by (optional): backend-team@company.com
```

## Security Best Practices

### 1. Key Storage

- **Never store API keys in code repositories**
- Use environment variables or secure key management systems
- Store keys in encrypted configuration files
- Use different keys for different environments

### 2. Permission Management

- **Principle of least privilege**: Only grant necessary permissions
- Regularly audit key permissions
- Use separate keys for different services/applications
- Remove unused permissions promptly

### 3. Key Rotation

- Regularly rotate API keys (recommended: every 90 days)
- Set expiration dates for temporary integrations
- Monitor key usage patterns for anomalies
- Deactivate keys immediately when no longer needed

### 4. Monitoring

- Monitor API key usage regularly with `circulum-keys stats`
- Set up alerts for unusual usage patterns
- Track key creation and deletion activities
- Review expired keys with `circulum-keys cleanup`

## Troubleshooting

### Connection Issues

If you encounter MongoDB connection issues:

1. **Check MongoDB Status**
   ```bash
   # For local MongoDB
   brew services list | grep mongodb
   # or
   systemctl status mongod
   ```

2. **Verify Connection String**
   ```bash
   # Test connection
   mongosh "mongodb://localhost:27017/circulum"
   ```

3. **Check Environment Variables**
   ```bash
   echo $MONGODB_URI
   ```

### Permission Errors

If you get permission-related errors:

1. **Check Available Permissions**
   ```bash
   circulum-keys create --help
   ```

2. **Verify Permission Format**
   - Use exact permission names (case-sensitive)
   - Separate multiple permissions with commas
   - No spaces around commas

### Common Error Messages

- **"Invalid permissions"**: Check permission names against the available list
- **"MongoDB connection failed"**: Verify MongoDB is running and connection string is correct
- **"API key not found"**: Double-check the API key ID
- **"Name is required"**: Provide a name for the API key

## Integration with API

The CLI-created API keys work seamlessly with the Circulum API:

```bash
# Create an API key
circulum-keys create --name "Test Key" --permissions "plans:read"

# Use the key with the API
curl -H "Authorization: Bearer sk_test_..." \
     http://localhost:3000/api/plans/creator/CREATOR_KEY
```

## Automation and Scripting

The CLI can be used in scripts and automation:

```bash
#!/bin/bash

# Create API key for new environment
API_KEY_OUTPUT=$(circulum-keys create \
  --name "Staging Environment" \
  --permissions "plans:read,subscriptions:read" \
  --environment staging \
  --rate-limit 2000)

# Extract the API key from output (implementation depends on your parsing needs)
echo "API key created successfully"

# Clean up expired keys daily
circulum-keys cleanup
```

## Development

### Building from Source

```bash
cd cli
npm install
npm run build
```

### Running in Development

```bash
npm run dev -- create --interactive
```

### Adding New Commands

1. Edit `cli/circulum-keys.ts`
2. Add new command using Commander.js syntax
3. Implement the command logic
4. Update this documentation

The CLI tool provides a comprehensive interface for managing API keys in the Circulum ecosystem, ensuring secure and efficient key management for all your integration needs.
