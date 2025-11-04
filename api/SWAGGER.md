# Swagger API Documentation

## Overview

Swagger/OpenAPI documentation has been successfully added to the Circulum API. This provides an interactive interface to explore and test all API endpoints.

## What Was Added

### 1. Dependencies Installed
- `swagger-ui-express` - Serves the Swagger UI interface
- `swagger-jsdoc` - Generates OpenAPI specification from JSDoc comments
- `@types/swagger-ui-express` - TypeScript definitions
- `@types/swagger-jsdoc` - TypeScript definitions

### 2. Swagger Configuration
Created `api/src/config/swagger.ts` with:
- OpenAPI 3.0 specification
- API metadata (title, version, description)
- Server configurations (development and production)
- Security schemes (API key authentication)
- Reusable component schemas (Error, Plan, Subscription, etc.)
- Auto-discovery of route annotations

### 3. API Routes Documentation
Added comprehensive Swagger annotations to all routes:

#### Subscriptions (`api/src/routes/subscriptions.ts`)
- POST `/api/subscriptions` - Subscribe to a plan
- GET `/api/subscriptions/{subscriber}/{planId}` - Get subscription details
- GET `/api/subscriptions/subscriber/{subscriber}` - Get all subscriptions for a subscriber
- DELETE `/api/subscriptions` - Cancel a subscription
- GET `/api/subscriptions/{subscriber}/{planId}/status` - Get subscription status

#### Plans (`api/src/routes/plans.ts`)
- POST `/api/plans` - Create a new subscription plan
- GET `/api/plans/{creator}/{planId}` - Get plan details
- GET `/api/plans/creator/{creator}` - Get all plans for a creator
- PUT `/api/plans/{creator}/{planId}` - Update a plan
- DELETE `/api/plans/{creator}/{planId}` - Deactivate a plan

#### Payments (`api/src/routes/payments.ts`)
- POST `/api/payments/process` - Process a recurring payment
- GET `/api/payments/history/{subscriber}/{planId}` - Get payment history
- GET `/api/payments/upcoming/{subscriber}` - Get upcoming payments
- GET `/api/payments/stats/creator/{creator}` - Get payment statistics

#### Integration (`api/src/routes/integration.ts`)
- GET `/api/integration/info` - Get integration information
- POST `/api/integration/validate` - Validate integration setup
- GET `/api/integration/webhooks` - List webhooks
- POST `/api/integration/webhooks` - Create a webhook
- GET `/api/integration/api-keys` - List API keys
- POST `/api/integration/api-keys` - Create an API key
- GET `/api/integration/sdk/{language}` - Get SDK examples
- GET `/api/integration/metrics` - Get API metrics

#### Health Check
- GET `/health` - Health check endpoint (no authentication required)

### 4. Swagger UI Integration
Modified `api/src/index.ts` to include:
- Swagger UI endpoint at `/api-docs`
- JSON specification endpoint at `/api-docs.json`
- Custom CSS for better appearance
- Removed Swagger UI topbar

## How to Access Swagger Documentation

### Once the server is running:

1. **Interactive UI**: Navigate to `http://localhost:3000/api-docs`
   - Explore all endpoints
   - Test API calls directly from the browser
   - View request/response schemas
   - Try out endpoints with different parameters

2. **JSON Specification**: Access `http://localhost:3000/api-docs.json`
   - Download the OpenAPI specification
   - Import into other tools (Postman, Insomnia, etc.)
   - Generate client SDKs

## Features

### Authentication
- All protected endpoints show the lock icon 🔒
- Click "Authorize" button to add your API key
- API key is sent as `X-API-Key` header

### Try It Out
- Click "Try it out" on any endpoint
- Fill in parameters
- Click "Execute" to make a real API call
- View the response

### Schemas
- Reusable request/response schemas
- Automatic validation documentation
- Example values for all fields

### Tags
Endpoints are organized by tags:
- Health
- Subscriptions
- Plans
- Payments
- Integration

## Example Usage

### Testing an Endpoint

1. Open Swagger UI at `http://localhost:3000/api-docs`
2. Expand the "Subscriptions" tag
3. Click on "GET /api/subscriptions/{subscriber}/{planId}"
4. Click "Try it out"
5. Enter values for `subscriber` and `planId`
6. Click "Authorize" and enter your API key
7. Click "Execute"
8. View the response

### Generating a Client

You can use the OpenAPI specification to generate client libraries:

```bash
# Download the spec
curl http://localhost:3000/api-docs.json > openapi.json

# Generate a client (example with openapi-generator)
openapi-generator-cli generate \
  -i openapi.json \
  -g typescript-axios \
  -o ./generated-client
```

## Troubleshooting

### Server Won't Start

**MongoDB Connection Required:**
The API requires MongoDB to be running. If you see `ECONNREFUSED ::1:27017`, start MongoDB:
```bash
# Using Docker
docker run -d -p 27017:27017 --name circulum-mongo mongo:latest

# Or using local MongoDB installation
mongod
```

**Module Resolution (Fixed):**
All path alias issues have been resolved with:
- `tsconfig-paths` installed for runtime path resolution
- Core module dependencies properly configured
- Relative imports used within core module

### Swagger UI Not Loading

1. Verify the server is running: `npm run dev`
2. Check console for any errors
3. Ensure port 3000 is available
4. Try accessing `/health` endpoint first

### Authentication Issues

1. Ensure you have a valid API key
2. Click the "Authorize" button in Swagger UI
3. Enter your key in the format: `your-api-key` (no "Bearer" prefix)
4. The key will be sent as `X-API-Key` header

## Customization

### Updating API Information

Edit `api/src/config/swagger.ts`:
- Change title, version, description
- Add/modify server URLs
- Update contact information
- Modify security schemes

### Adding New Endpoints

When adding new endpoints:
1. Add JSDoc comments with `@swagger` tag
2. Follow the OpenAPI 3.0 specification format
3. Use refs to shared schemas: `$ref: '#/components/schemas/Error'`
4. The documentation will auto-update on server restart

### Customizing Appearance

Modify the Swagger UI setup in `api/src/index.ts`:
```typescript
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Circulum API Documentation',
  // Add more customization options here
}));
```

## Next Steps

1. **Fix Path Aliases**: Resolve the `@core` module resolution issue
2. **Start Server**: Run `npm run dev` in the api directory
3. **Access Docs**: Open `http://localhost:3000/api-docs`
4. **Test Endpoints**: Try out the interactive API documentation
5. **Share with Team**: Share the Swagger URL with your development team

## Resources

- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc)
- [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express)

## Summary

The Circulum API now has comprehensive, interactive documentation accessible via Swagger UI. All endpoints are documented with:
- Complete request/response schemas
- Authentication requirements
- Example values
- Error responses
- Parameter descriptions

This makes it easy for developers to understand and integrate with the API.
