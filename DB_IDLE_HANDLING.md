# Database Idle State Handling

This application includes automatic database idle state detection and recovery mechanisms.

## Features

### 1. **Automatic DB Health Monitoring**
- Monitors database connection status on every page load
- Detects when the database is idle or sleeping
- Automatically attempts to wake up idle databases

### 2. **User-Friendly UI Feedback**
- Shows a loading overlay when database is waking up
- Displays clear messages about database status
- Automatic retry mechanism with progress indication
- Auto-refresh when database becomes available

### 3. **Server-Side Protection**
- All database operations are wrapped with retry logic
- Automatic reconnection attempts for idle databases
- Configurable timeout and retry settings

## Components

### Client Components

#### `DBStatusChecker`
Located in `src/components/DBStatusChecker.tsx`

A React component that monitors database health and displays status to users:
- Checks DB health on component mount
- Shows loading overlay during connection attempts
- Provides retry button if connection fails
- Auto-refreshes page when database is ready

### Server Components

#### Database Health (`db-health.ts`)
Located in `src/lib/db-health.ts`

Core health checking functionality:
- `checkDatabaseHealth()` - Verifies database connectivity
- `wakeUpDatabase()` - Attempts to wake idle database with retries
- `keepDatabaseAlive()` - Periodic ping to prevent idle state

#### Database Operation Wrapper (`db-wrapper.ts`)
Located in `src/lib/db-wrapper.ts`

Wraps database operations with automatic error handling:
- `withDBConnection()` - Executes operations with retry logic
- `startKeepAlive()` - Starts periodic database pings
- `stopKeepAlive()` - Stops keep-alive process

#### Action Wrapper (`db-action-wrapper.ts`)
Located in `src/lib/db-action-wrapper.ts`

Wrappers for server actions:
- `withDBAction()` - Wraps server actions with error handling
- `safeDBQuery()` - Safe query execution with fallback values

## API Endpoints

### GET `/api/db-health`
Returns current database health status:
```json
{
  "isHealthy": true,
  "isIdle": false,
  "message": "Database is connected and responsive",
  "lastChecked": "2026-01-29T...",
  "responseTime": 45
}
```

### POST `/api/db-health/wake-up`
Attempts to wake up an idle database:
```json
{
  "isHealthy": true,
  "isIdle": false,
  "message": "Database is now awake and ready!",
  "lastChecked": "2026-01-29T..."
}
```

## Usage

### Using Database Wrappers in Server Actions

#### Option 1: Wrap Individual Actions
```typescript
import { withDBAction } from '@/lib/db-action-wrapper';
import db from '@/lib/db-azure';

export async function getEvents() {
  return await withDBAction(
    async () => await db.getEvents(),
    'Failed to fetch events'
  );
}
```

#### Option 2: Wrap Operations in Existing Actions
```typescript
import { withDBConnection } from '@/lib/db-wrapper';
import db from '@/lib/db-azure';

export async function registerSponsorship(formData: any) {
  return await withDBConnection(async () => {
    // Your database operations here
    await db.createRegistration(formData);
    await db.createRegistrationDates(dates);
    return { success: true };
  });
}
```

### Using Safe Queries with Defaults
```typescript
import { safeDBQuery } from '@/lib/db-action-wrapper';
import db from '@/lib/db-azure';

export async function getEventsSafe() {
  return await safeDBQuery(
    async () => await db.getEvents(),
    [], // default empty array if DB fails
    'Failed to fetch events'
  );
}
```

## Configuration

### Retry Settings
You can customize retry behavior in `db-wrapper.ts`:

```typescript
const DEFAULT_OPTIONS = {
  maxRetries: 3,        // Number of retry attempts
  retryDelay: 2000,     // Delay between retries (ms)
  timeoutMs: 30000,     // Operation timeout (ms)
};
```

### Keep-Alive Interval
To prevent database from going idle, start keep-alive:

```typescript
import { startKeepAlive } from '@/lib/db-wrapper';

// Ping database every 5 minutes
const timer = startKeepAlive(5 * 60 * 1000);
```

## Middleware

The middleware in `src/middleware.ts` runs on every request to track database interactions. You can enhance it to:
- Pre-warm database connections
- Log database health metrics
- Implement rate limiting for wake-up attempts

## Error Messages

The system provides user-friendly error messages:

- **Idle Database**: "Database is currently idle. Please refresh the page and try again."
- **Connection Issues**: "Unable to connect to database. Please try again in a moment."
- **Timeout**: "Database connection timeout - database may be idle or sleeping"

## Testing

To test the idle state handling:

1. Stop/pause your database service
2. Try to access the application
3. You should see the "Database Connection Issue" overlay
4. Click "Retry Connection" to attempt wake-up
5. Once database is available, page auto-refreshes

## Best Practices

1. **Always use wrappers** for database operations in server actions
2. **Don't block user interactions** - show loading states during DB operations
3. **Provide clear feedback** - let users know what's happening
4. **Log errors** - monitor for patterns in idle state occurrences
5. **Consider keep-alive** - if database idles frequently, implement periodic pings

## Troubleshooting

### Database Still Shows as Idle
- Check database service status in your hosting platform
- Verify database credentials in environment variables
- Review connection timeout settings in `db-azure.ts`

### Too Many Retries
- Adjust `maxRetries` in wrapper configuration
- Increase `retryDelay` for slower database wake-ups
- Check if database tier has cold-start limitations

### Performance Issues
- Reduce keep-alive frequency if too aggressive
- Monitor database connection pool settings
- Consider upgrading database tier for faster wake-up
