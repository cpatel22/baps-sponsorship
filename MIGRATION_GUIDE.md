# Migration from SQLite to Amazon Aurora PostgreSQL

This guide will help you migrate your sponsorship system from SQLite to Amazon Aurora PostgreSQL.

## Prerequisites

1. **Amazon Aurora PostgreSQL Database**: Set up an Aurora PostgreSQL instance on AWS RDS
2. **Database Credentials**: Have your connection string ready
3. **Node.js/Bun**: Ensure you have Node.js or Bun installed

## Migration Steps

### Step 1: Export Existing Data

Run the export script to save your current SQLite data:

```bash
node export-sqlite-data.js
```

This creates `sqlite-data-export.json` with all your current data.

### Step 2: Set Up Environment Variables

Copy the example environment file and configure your PostgreSQL connection:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your DATABASE_URL:

```env
# For Amazon Aurora PostgreSQL
DATABASE_URL=postgresql://username:password@your-cluster.region.rds.amazonaws.com:5432/database_name
```

**Connection String Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```

**For Aurora:**
- Host: Your Aurora cluster endpoint (e.g., `mydb.cluster-xyz.us-east-1.rds.amazonaws.com`)
- Port: Usually `5432`
- Database: Your database name
- SSL: Recommended for production (Aurora supports SSL)

### Step 3: Initialize PostgreSQL Schema

The schema will be automatically created when you first run the application, or you can manually initialize it:

```bash
node import-to-postgres.js
```

This script will:
1. Connect to your PostgreSQL database
2. Create all necessary tables
3. Import data from `sqlite-data-export.json`

### Step 4: Update Dependencies

The dependencies have already been updated in `package.json`:
- ✅ Added: `pg` (PostgreSQL client)
- ✅ Added: `@types/pg` (TypeScript types)
- ⚠️ Keep: `better-sqlite3` (temporarily for export script)

Install dependencies:

```bash
bun install
```

### Step 5: Update Application Code

**IMPORTANT**: The database queries in `src/app/actions.ts` need to be updated from SQLite syntax to PostgreSQL.

Key changes needed:
1. Convert `?` placeholders to `$1, $2, $3...` format
2. Add `await` to all database calls (they're now async)
3. Update `.prepare().get()` to `await db.get()`
4. Update `.prepare().all()` to `await db.all()`
5. Update `.prepare().run()` to `await db.run()`

**Example conversion:**

Before (SQLite):
```typescript
const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
```

After (PostgreSQL):
```typescript
const user = await db.get('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
```

### Step 6: Test the Migration

1. Start your development server:
```bash
bun dev
```

2. Test the following functionality:
   - ✅ User login
   - ✅ Event management
   - ✅ Registration creation
   - ✅ Data lookup
   - ✅ Email functionality

### Step 7: Deploy to Production

1. **Configure Production Database**: Use your Aurora PostgreSQL endpoint
2. **Set Environment Variables** in your hosting platform (Railway, Vercel, etc.)
3. **Enable SSL**: For Aurora, add `?sslmode=require` to your connection string
4. **Run Migration**: Execute `import-to-postgres.js` on your production database

## Amazon Aurora Specific Configuration

### Security Group Settings
Ensure your Aurora security group allows inbound connections:
- **Port**: 5432
- **Source**: Your application's IP or security group

### SSL/TLS Connection
Aurora PostgreSQL supports encrypted connections. Update your connection string:

```env
DATABASE_URL=postgresql://user:password@cluster.region.rds.amazonaws.com:5432/db?sslmode=require
```

### Connection Pooling
The new `db.ts` configuration includes connection pooling optimized for serverless:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

For Aurora Serverless, consider using RDS Proxy for better connection management.

## Query Changes Reference

| SQLite | PostgreSQL |
|--------|------------|
| `db.prepare(sql).get(params)` | `await db.get(sql, [params])` |
| `db.prepare(sql).all(params)` | `await db.all(sql, [params])` |
| `db.prepare(sql).run(params)` | `await db.run(sql, [params])` |
| `?` placeholders | `$1, $2, $3` placeholders |
| `TEXT` type | `TEXT` type (compatible) |
| `CURRENT_TIMESTAMP` | `CURRENT_TIMESTAMP` (compatible) |

## Rollback Plan

If you need to rollback to SQLite:

1. Keep your `sponsorship.db` file as backup
2. The export script preserves all data
3. Revert the changes in `src/lib/db.ts`
4. Reinstall `better-sqlite3`

## Troubleshooting

### Connection Issues
```
Error: connect ETIMEDOUT
```
- Check security group settings
- Verify Aurora cluster is publicly accessible (if needed)
- Confirm VPC settings

### SSL Certificate Issues
```
Error: self signed certificate
```
Add to connection options:
```javascript
ssl: { rejectUnauthorized: false }
```

### Performance Optimization
- Use Aurora's read replicas for read-heavy workloads
- Enable query caching
- Monitor using CloudWatch metrics

## Support

For issues specific to:
- **Aurora Setup**: AWS Support or AWS Documentation
- **Application Migration**: Check this guide or raise an issue
- **Query Performance**: Use PostgreSQL EXPLAIN ANALYZE

## Next Steps

After migration:
1. ✅ Remove SQLite dependencies (optional)
2. ✅ Delete `sponsorship.db` and export scripts (after confirming success)
3. ✅ Set up automated backups in Aurora
4. ✅ Configure monitoring and alerts
5. ✅ Update deployment documentation
