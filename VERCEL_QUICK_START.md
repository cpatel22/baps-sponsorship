# Vercel Deployment - Quick Start

## 🚀 Fastest Way to Deploy

### Step 1: Create .env.local with Your Credentials

Create a file named `.env.local` in the project root:

```bash
bapsorlando_PGHOST=<paste-your-host>
bapsorlando_PGUSER=<paste-your-user>
bapsorlando_PGDATABASE=<paste-your-database>
bapsorlando_PGPORT=5432
bapsorlando_PGSSLMODE=require
```

### Step 2: Run Setup Script

**Windows (PowerShell):**
```powershell
.\setup-vercel.ps1
```

**Mac/Linux:**
```bash
chmod +x setup-vercel.sh
./setup-vercel.sh
```

**Or manually:**
```bash
bun install
bun run db:init
```

### Step 3: Deploy to Vercel

```bash
vercel --prod
```

That's it! Your app is now live with a fully configured database.

## 📋 Manual Setup (Alternative)

If you prefer to do it manually:

1. **Set Environment Variables in Vercel Dashboard:**
   - Go to: Project Settings → Environment Variables
   - Add all your `bapsorlando_*` variables
   - Set to: Production, Preview, and Development

2. **Deploy:**
   ```bash
   git push origin main
   ```
   Or:
   ```bash
   vercel --prod
   ```

The `vercel-build` script will automatically initialize the database on first deployment.

## 🔑 First Login

After deployment:
1. Visit: `https://your-app.vercel.app`
2. Login with:
   - **Email:** `admin@example.com`
   - **Password:** `admin123`
3. **IMMEDIATELY change the password:**
   - Go to: Admin → Users
   - Click Edit on admin user
   - Set a strong password

## ✅ What You Get

- ✅ All database tables created automatically
- ✅ 3 pre-configured events (Samaiyas, Mahila Samaiyas, Weekly Satsang Sabha)
- ✅ Admin user ready to use
- ✅ Email template system set up
- ✅ Optimized for Vercel serverless functions
- ✅ SSL/TLS encryption enabled
- ✅ Connection pooling configured

## 🔍 Verify Everything Works

1. **Check Database:**
   - Vercel Dashboard → Storage → Your Postgres
   - Click "Query" tab
   - Run: `SELECT * FROM events;`
   - Should show 3 events

2. **Test Locally:**
   ```bash
   bun dev
   ```
   - Open: http://localhost:3000
   - Try logging in

3. **Test on Vercel:**
   - Visit your deployed URL
   - Login, create a test registration
   - Check data appears in Vercel Postgres

## 🐛 Troubleshooting

### "Cannot connect to database"
**Solution:**
- Verify all `bapsorlando_*` env vars are set correctly
- Check `.env.local` has no typos
- Ensure `PGSSLMODE=require`

### "Tables not found"
**Solution:**
```bash
bun run db:init
```

### "Build failed on Vercel"
**Solution:**
- Check Vercel build logs
- Ensure all env variables are set in Vercel dashboard
- Verify environment is set to "Production"

### "Admin login fails"
**Solution:**
- Run `bun run db:init` to create admin user
- Or manually insert via Vercel Postgres Query interface

## 📞 Need Help?

1. Check [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for detailed guide
2. Review [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for PostgreSQL specifics
3. Check Vercel function logs for errors
4. Verify env variables in Vercel dashboard

---

**Ready?** Run `.\setup-vercel.ps1` and deploy! 🎉
