# Quick Start: Migrating to Amazon Aurora PostgreSQL

## Step 1: Set Up Aurora PostgreSQL

### Option A: AWS Console
1. Go to AWS RDS Console
2. Click "Create database"
3. Choose "Amazon Aurora"
4. Select "PostgreSQL-compatible"
5. Choose your template (Production or Dev/Test)
6. Configure:
   - DB cluster identifier: `sponsorship-db`
   - Master username: `postgres` (or your choice)
   - Master password: (create a strong password)
7. Instance configuration: Choose appropriate size
8. Connectivity:
   - VPC: Default or your VPC
   - Public access: Yes (for initial setup)
   - Security group: Create new or use existing
9. Database authentication: Password authentication
10. Additional configuration:
    - Initial database name: `sponsorship`
11. Click "Create database"

### Option B: AWS CLI
```bash
aws rds create-db-cluster \
  --db-cluster-identifier sponsorship-db \
  --engine aurora-postgresql \
  --master-username postgres \
  --master-user-password YOUR_PASSWORD \
  --database-name sponsorship

aws rds create-db-instance \
  --db-instance-identifier sponsorship-db-instance \
  --db-cluster-identifier sponsorship-db \
  --engine aurora-postgresql \
  --db-instance-class db.t3.medium
```

## Step 2: Configure Security Group

1. Go to EC2 > Security Groups
2. Find your Aurora security group
3. Add inbound rule:
   - Type: PostgreSQL
   - Protocol: TCP
   - Port: 5432
   - Source: Your IP (for testing) or `0.0.0.0/0` (less secure)

## Step 3: Get Your Connection String

From AWS RDS Console, find your cluster endpoint:
```
your-cluster-name.cluster-xxxxx.region.rds.amazonaws.com
```

Build your connection string:
```
postgresql://postgres:YOUR_PASSWORD@your-cluster-name.cluster-xxxxx.us-east-1.rds.amazonaws.com:5432/sponsorship
```

## Step 4: Configure Environment Variables

Create `.env.local`:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@your-aurora-endpoint:5432/sponsorship
NODE_ENV=development
```

## Step 5: Run Migration

```bash
# 1. Export SQLite data (if not already done)
bun run db:export

# 2. Import to PostgreSQL
bun run db:import

# 3. Replace actions file
mv src/app/actions.ts src/app/actions-sqlite-backup.ts
mv src/app/actions-postgresql.ts src/app/actions.ts
```

## Step 6: Test Locally

```bash
# Start development server
bun dev

# Open browser to http://localhost:3000
# Test login, registrations, etc.
```

## Step 7: Deploy to Production

### For Railway:
```bash
# Set environment variable in Railway dashboard
DATABASE_URL=postgresql://postgres:PASSWORD@aurora-endpoint:5432/sponsorship

# Deploy
railway up
```

### For Vercel:
```bash
# Set environment variable
vercel env add DATABASE_URL

# Enter your PostgreSQL connection string when prompted

# Deploy
vercel --prod
```

### For Other Platforms:
Set the `DATABASE_URL` environment variable to your Aurora PostgreSQL connection string.

## Verification Checklist

- [ ] Aurora cluster is running
- [ ] Security group allows connections on port 5432
- [ ] Connection string is correct
- [ ] Environment variables are set
- [ ] Data migration completed successfully
- [ ] Application starts without errors
- [ ] Can login with existing users
- [ ] Can create new registrations
- [ ] Emails are sending correctly

## Common Issues

### Connection Timeout
**Problem**: Can't connect to Aurora
**Solutions**:
- Check security group allows your IP on port 5432
- Verify public accessibility is enabled
- Check VPC and subnet configuration

### SSL Error
**Problem**: SSL certificate errors
**Solution**: Add to connection string:
```
?sslmode=require
```
Or in code, set:
```typescript
ssl: { rejectUnauthorized: false }
```

### Authentication Failed
**Problem**: Password incorrect
**Solutions**:
- Verify username and password
- Check for special characters in password (may need URL encoding)
- Ensure master username is correct

### Schema Errors
**Problem**: Tables not found
**Solution**: The schema is auto-created on first connection, but you can manually run:
```bash
# Connect with psql
psql "postgresql://postgres:PASSWORD@endpoint:5432/sponsorship"

# Verify tables exist
\dt
```

## Performance Tuning

For production, consider:

1. **Use Aurora Serverless v2** for automatic scaling
2. **Enable Performance Insights** for monitoring
3. **Set up Read Replicas** for high-traffic scenarios
4. **Use RDS Proxy** for better connection management
5. **Enable automated backups** (default retention: 7 days)

## Cost Optimization

- Start with smaller instance types (db.t3.small)
- Use Aurora Serverless v2 for variable workloads
- Set up auto-pause for non-production environments
- Monitor using AWS Cost Explorer

## Next Steps

After successful migration:
1. ✅ Remove SQLite files (optional):
   ```bash
   rm sponsorship.db
   rm export-sqlite-data.js
   ```
2. ✅ Remove `better-sqlite3` dependency (optional):
   ```bash
   bun remove better-sqlite3 @types/better-sqlite3
   ```
3. ✅ Set up automated backups
4. ✅ Configure monitoring and alerts
5. ✅ Update documentation

## Support

- **AWS Support**: Use AWS Support Console
- **PostgreSQL**: https://www.postgresql.org/support/
- **Application Issues**: Check logs in your hosting platform

---

**Ready to migrate?** Start with Step 1 above! 🚀
