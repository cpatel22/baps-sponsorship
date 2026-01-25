# Vercel Deployment Guide

## Quick Setup for Your Existing Vercel Postgres Database

You already have Vercel Postgres credentials. Here's how to connect your app:

### Step 1: Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables, and add these:

```bash
bapsorlando_PGHOST=<your-host>
bapsorlando_PGUSER=<your-user>
bapsorlando_PGDATABASE=<your-database>
bapsorlando_PGPORT=5432
bapsorlando_PGSSLMODE=require
bapsorlando_AWS_REGION=<your-region>
bapsorlando_AWS_ACCOUNT_ID=<your-account-id>
bapsorlando_AWS_RESOURCE_ARN=<your-resource-arn>
bapsorlando_AWS_ROLE_ARN=<your-role-arn>
```

Or simply use the connection string format:
```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

### Step 2: Initialize Database (One Time)

**Option A: Run locally with your Vercel credentials**

Create `.env.local` file:
```bash
bapsorlando_PGHOST=your-host
bapsorlando_PGUSER=your-user
bapsorlando_PGDATABASE=your-database
bapsorlando_PGPORT=5432
bapsorlando_PGSSLMODE=require
```

Then run:
```bash
bun run db:init
```

**Option B: Use Vercel Postgres Dashboard**

1. Go to Vercel Dashboard → Storage → Your Postgres Database
2. Click "Query" tab
3. Copy and paste the SQL from `scripts/init-database.js` (the CREATE TABLE statements)
4. Run the queries

### Step 3: Replace Actions File

```bash
# Backup original
mv src/app/actions.ts src/app/actions-sqlite-backup.ts

# Use PostgreSQL version
mv src/app/actions-postgresql.ts src/app/actions.ts
```

### Step 4: Deploy to Vercel

```bash
vercel --prod
```

Or push to your Git repository if auto-deployment is enabled.

## What Gets Created

The initialization script creates:

### Tables
- ✅ `events` - Event types (Samaiyas, Mahila Samaiyas, Weekly Satsang Sabha)
- ✅ `event_dates` - Specific dates for events
- ✅ `registrations` - Sponsorship registrations
- ✅ `registration_dates` - Which events/dates each registration selected
- ✅ `users` - Admin and user accounts
- ✅ `email_templates` - Email templates for confirmations
- ✅ `email_settings` - SMTP configuration

### Master Data
- **3 Events**: Pre-configured event types
- **1 Admin User**: 
  - Email: `admin@example.com`
  - Password: `admin123`
  - ⚠️ **CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN!**
- **1 Email Template**: Default welcome template

## Vercel-Specific Configuration

### Build Settings

The `vercel-build` script in package.json automatically:
1. Initializes the database on first deployment
2. Builds the Next.js application

### Environment Variables Best Practices

For Vercel Postgres:
- Use the `bapsorlando_*` prefixed variables (as you already have)
- Enable SSL mode (`PGSSLMODE=require`)
- Set all environment variables to "Production" and "Preview" environments

### Connection Pooling

The app is configured with optimal connection pooling for Vercel:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 10 seconds

This works well with Vercel's serverless functions.

## Testing the Deployment

After deployment:

1. **Visit your app**: `https://your-app.vercel.app`
2. **Login**: Use `admin@example.com` / `admin123`
3. **Change password**: Go to Admin → Users
4. **Test registration**: Create a test sponsorship
5. **Check database**: Use Vercel Postgres dashboard to verify data

## Troubleshooting

### "No database connection"
- Verify all environment variables are set in Vercel
- Check Vercel Postgres is in the same region
- Ensure SSL mode is set to `require`

### "Tables not found"
- Run the initialization script: `bun run db:init`
- Or manually create tables using Vercel Postgres Query interface

### "Authentication failed"
- Double-check `PGUSER` matches your Vercel Postgres user
- Verify password is correct (if using DATABASE_URL)
- Ensure database name is exact match

### Build failures
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure `bun.lockb` or `package-lock.json` is committed

## Migration from SQLite

If you have existing SQLite data:

1. **Export data**:
   ```bash
   bun run db:export
   ```

2. **Import to Vercel Postgres**:
   ```bash
   # Set your Vercel credentials in .env.local
   bun run db:import
   ```

3. **Verify import**:
   - Check Vercel Postgres dashboard
   - Login to your deployed app

## Security Checklist

- [ ] Changed default admin password
- [ ] Set strong passwords for all users
- [ ] Environment variables are set to Production only (not visible in code)
- [ ] SSL mode enabled (`PGSSLMODE=require`)
- [ ] No credentials in Git repository
- [ ] `.env.local` is in `.gitignore`

## Cost Optimization

Vercel Postgres pricing:
- **Hobby**: Free tier available (limited)
- **Pro**: Pay-as-you-go

Tips:
- Monitor database size in Vercel dashboard
- Set up usage alerts
- Regular cleanup of old registrations (optional)

## Support

- **Vercel Docs**: https://vercel.com/docs/storage/vercel-postgres
- **Postgres Docs**: https://www.postgresql.org/docs/
- **App Issues**: Check Vercel function logs

---

**Ready to deploy?** Follow steps 1-4 above! 🚀
