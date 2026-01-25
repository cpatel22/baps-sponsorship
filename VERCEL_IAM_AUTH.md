# Deploying to Vercel with IAM Authentication

Since you're using Vercel Postgres with AWS IAM authentication (no password), here's the easiest deployment path:

## 🚀 Direct Deployment (Recommended)

Instead of initializing locally, deploy to Vercel and let it initialize automatically:

### Step 1: Set Environment Variables in Vercel

Go to your Vercel project → Settings → Environment Variables and add all your `bapsorlando_*` variables:

```
bapsorlando_AWS_ACCOUNT_ID=590042306033
bapsorlando_AWS_REGION=us-east-1
bapsorlando_AWS_RESOURCE_ARN=arn:aws:rds:us-east-1:590042306033:cluster:baps-sponsorship
bapsorlando_AWS_ROLE_ARN=arn:aws:iam::590042306033:role/Vercel/access-baps-sponsorship
bapsorlando_PGDATABASE=postgres
bapsorlando_PGHOST=baps-sponsorship.cluster-c21i8w2y6ac1.us-east-1.rds.amazonaws.com
bapsorlando_PGPORT=5432
bapsorlando_PGSSLMODE=require
bapsorlando_PGUSER=postgres
```

### Step 2: Deploy

```bash
git add .
git commit -m "Configure for Vercel Postgres with IAM auth"
git push origin main
```

Or use Vercel CLI:
```bash
vercel --prod
```

The `vercel-build` script will automatically run `db:init` during deployment!

### Step 3: Verify

After deployment:
1. Check Vercel deployment logs
2. Look for "✅ Database initialization completed successfully!"
3. Visit your app and login with `admin@example.com` / `admin123`

## 🔧 Local Development Alternative

If you want to test locally, you need AWS credentials configured:

### Option A: AWS CLI Configured
```powershell
# Install AWS CLI if not already installed
# Then configure it:
aws configure

# Then run:
bun run db:init
```

### Option B: Use Vercel CLI
```powershell
# Link to your Vercel project
vercel link

# Pull environment variables (including IAM role)
vercel env pull .env.local

# Now run:
bun run db:init
```

### Option C: Initialize via Vercel Postgres Query Tab

1. Go to Vercel Dashboard → Storage → Your Postgres
2. Click "Query" tab
3. Paste and run this SQL:

\`\`\`sql
-- Create tables
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS event_dates (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  date TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  spouse_first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  sponsorship_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registration_dates (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  date TEXT,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  recovery_email TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  to_field TEXT DEFAULT '{{email}}',
  cc_field TEXT,
  bcc_field TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email_from TEXT NOT NULL,
  smtp_server TEXT NOT NULL,
  smtp_port_tls INTEGER DEFAULT 587,
  smtp_port_ssl INTEGER DEFAULT 465,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  connection_security TEXT DEFAULT 'TLS',
  reply_to_email TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert master data
INSERT INTO events (id, name, sort_order) VALUES 
('event_a', 'Samaiyas', 0),
('event_b', 'Mahila Samaiyas', 1),
('event_c', 'Weekly Satsang Sabha', 2)
ON CONFLICT (id) DO NOTHING;

-- Create admin user
INSERT INTO users (id, email, password, role, recovery_email) 
VALUES ('admin001', 'admin@example.com', 'admin123', 'super_admin', 'recovery@example.com')
ON CONFLICT (email) DO NOTHING;
\`\`\`

## ✅ Recommended Path

**Just deploy to Vercel!** The easiest way:

1. Set environment variables in Vercel dashboard
2. Deploy (git push or `vercel --prod`)
3. Database initializes automatically
4. Done! 🎉

The app is configured to work with Vercel's IAM authentication out of the box.
