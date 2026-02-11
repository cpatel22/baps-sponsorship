# Database Idle State Handling - Quick Start Guide

## 🚀 What's Been Added

Your application now includes automatic database idle state detection and recovery! When users access your website and the database is idle, they'll see a friendly message and the system will automatically attempt to wake it up.

## ✅ What Works Now

1. **Automatic Detection**: When any user visits any URL, the app checks if the database is idle
2. **User-Friendly UI**: Shows a professional loading overlay with status messages
3. **Automatic Recovery**: Attempts to wake up the database automatically
4. **Retry Mechanism**: Allows users to manually retry if automatic wake-up fails
5. **Auto-Refresh**: Page automatically refreshes once database is ready

## 📁 Files Added

### Core Components
- `src/components/DBStatusChecker.tsx` - UI component that shows DB status to users
- `src/lib/db-health.ts` - Database health checking and wake-up logic
- `src/lib/db-wrapper.ts` - Wrapper for DB operations with retry logic
- `src/lib/db-action-wrapper.ts` - Helpers for wrapping server actions

### API Routes
- `src/app/api/db-health/route.ts` - GET endpoint for DB health check
- `src/app/api/db-health/wake-up/route.ts` - POST endpoint to wake up DB

### Middleware
- `src/middleware.ts` - Runs on every request (ready for future enhancements)

### Documentation
- `DB_IDLE_HANDLING.md` - Comprehensive documentation
- `src/lib/ACTIONS_EXAMPLE.ts` - Examples of how to wrap your actions

### Updated Files
- `src/app/layout.tsx` - Added DBStatusChecker component
- `src/lib/db-azure.ts` - Enhanced connection error handling

## 🎯 How It Works

### User Experience Flow

1. User visits any page on your website
2. `DBStatusChecker` component loads and checks database health via `/api/db-health`
3. If database is healthy → User sees normal page
4. If database is idle:
   - Shows overlay: "Database is idle or sleeping. Attempting to wake it up..."
   - Automatically calls `/api/db-health/wake-up`
   - Retries up to 5 times with 3-second delays
   - Once successful, page auto-refreshes
   - If all retries fail, shows "Retry Connection" button

### Technical Flow

```
User Request
    ↓
DBStatusChecker (Client Component)
    ↓
GET /api/db-health
    ↓
checkDatabaseHealth() → Tests DB with simple query
    ↓
If Idle: POST /api/db-health/wake-up
    ↓
wakeUpDatabase() → Retries connection multiple times
    ↓
Success: Auto-refresh page
Failure: Show retry button
```

## 🔧 Next Steps (Optional but Recommended)

### Step 1: Update Your Server Actions

To make your server-side database operations more resilient, wrap them with the provided helpers.

**Option A**: Wrap individual actions in `src/app/actions.ts`:

```typescript
import { withDBAction } from '@/lib/db-action-wrapper';

// Before
export async function getEvents() {
  return await db.getEvents();
}

// After
export async function getEvents() {
  return await withDBAction(
    async () => await db.getEvents(),
    'Failed to fetch events'
  );
}
```

**Option B**: Use safe queries with fallback values:

```typescript
import { safeDBQuery } from '@/lib/db-action-wrapper';

export async function getEventsSafe() {
  return await safeDBQuery(
    async () => await db.getEvents(),
    [], // Return empty array if DB fails
    'Failed to fetch events'
  );
}
```

See `src/lib/ACTIONS_EXAMPLE.ts` for complete examples.

### Step 2: Configure Settings (Optional)

Adjust retry and timeout settings in `src/lib/db-wrapper.ts`:

```typescript
const DEFAULT_OPTIONS = {
  maxRetries: 3,        // Number of attempts (increase for slower DBs)
  retryDelay: 2000,     // Delay between retries in ms
  timeoutMs: 30000,     // Operation timeout in ms
};
```

### Step 3: Enable Keep-Alive (Optional)

If your database frequently goes idle, you can add a keep-alive mechanism to prevent it. Add to `src/app/layout.tsx`:

```typescript
import { startKeepAlive } from '@/lib/db-wrapper';

// In a useEffect or server startup
startKeepAlive(5 * 60 * 1000); // Ping every 5 minutes
```

## 🧪 Testing

1. **Test Idle State**:
   - Pause/stop your database service
   - Visit your website
   - You should see the "Database Connection Issue" overlay
   - Click "Retry Connection"

2. **Test Auto-Recovery**:
   - Start with database stopped
   - Visit website (should show loading overlay)
   - Start database service
   - System should detect it's alive and auto-refresh

3. **Test Normal Operation**:
   - With database running, visit website
   - Should work normally with no overlay

## 📊 Monitoring

Check your browser console and server logs for:
- "Connected to Azure SQL Database" - Successful connection
- "Database appears idle" - Idle state detected
- "Wake-up attempt X failed" - Retry in progress
- "Database is now awake" - Recovery successful

## ⚙️ Configuration

### Environment Variables
Ensure these are set in your `.env` file:
```
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
AZURE_SQL_PORT=1433
```

### Connection Pool Settings
Currently set in `src/lib/db-azure.ts`:
```typescript
pool: {
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
}
```

## 🎨 Customization

### Change UI Messages
Edit `src/components/DBStatusChecker.tsx`:
- Line ~67: "Connecting to Database"
- Line ~72: "Database Connection Issue"
- Line ~84: Button text

### Change Retry Logic
Edit `src/lib/db-health.ts`:
- `wakeUpDatabase()` function
- Default: 3 retries with 2-second delays

### Customize Wake-Up Behavior
Edit `src/app/api/db-health/wake-up/route.ts`:
- Currently: 5 retries with 3-second delays
- Change parameters: `wakeUpDatabase(retries, delayMs)`

## ❓ FAQ

**Q: Will this slow down my website?**
A: No. The health check is a simple query (~50ms) that only runs when the page loads. If DB is healthy, users won't notice any delay.

**Q: What happens if the database never wakes up?**
A: Users will see a "Retry Connection" button they can click manually. The error is logged for you to investigate.

**Q: Can I disable this feature?**
A: Yes. Simply remove the `<DBStatusChecker />` line from `src/app/layout.tsx`.

**Q: Does this work with both SQLite and Azure SQL?**
A: The components work with any database. The health check currently uses Azure SQL (`db-azure.ts`). If you're using SQLite (`db.ts`), update the import in `db-health.ts`.

**Q: How do I know if it's working?**
A: Test by stopping your database service. You should see the loading overlay appear automatically.

## 🐛 Troubleshooting

**Issue**: Overlay appears even when DB is running
- Check database credentials in environment variables
- Review connection timeout settings
- Check server logs for connection errors

**Issue**: Database doesn't wake up
- Verify database service is actually running
- Check if database tier supports wake-up (some serverless tiers take 30+ seconds)
- Increase retry count and delay in wake-up settings

**Issue**: Too many retries showing
- Increase `retryDelay` to give database more time
- Check if database needs manual intervention to start

## 📚 Full Documentation

For complete technical details, see `DB_IDLE_HANDLING.md`.

For code examples, see `src/lib/ACTIONS_EXAMPLE.ts`.

## 🎉 You're Done!

The idle state handling is now active! Your users will have a much better experience when the database is idle or sleeping.
