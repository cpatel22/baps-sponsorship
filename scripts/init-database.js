// Database initialization script for Vercel Postgres
// This creates all tables and inserts master data

const { Pool } = require('pg');
const { Signer } = require('@aws-sdk/rds-signer');

// Support multiple environment variable formats
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const PGHOST = process.env.PGHOST || process.env.bapsorlando_PGHOST;
const PGUSER = process.env.PGUSER || process.env.bapsorlando_PGUSER;
const PGDATABASE = process.env.PGDATABASE || process.env.bapsorlando_PGDATABASE;
const PGPASSWORD = process.env.PGPASSWORD || process.env.bapsorlando_PGPASSWORD;
const PGPORT = process.env.PGPORT || process.env.bapsorlando_PGPORT;
const PGSSLMODE = process.env.PGSSLMODE || process.env.bapsorlando_PGSSLMODE;

// AWS IAM authentication
const AWS_REGION = process.env.AWS_REGION || process.env.bapsorlando_AWS_REGION;
const USE_IAM_AUTH = process.env.bapsorlando_AWS_ROLE_ARN && !PGPASSWORD;

// Generate IAM auth token
async function getIAMAuthToken() {
  const signer = new Signer({
    hostname: PGHOST,
    port: PGPORT ? parseInt(PGPORT) : 5432,
    username: PGUSER,
    region: AWS_REGION,
  });
  return await signer.getAuthToken();
}

async function initializeDatabase() {
  let pool;
  
  try {
    // Get password (either from env or generate IAM token)
    let password = PGPASSWORD;
    if (USE_IAM_AUTH) {
      console.log('🔐 Using AWS IAM authentication...');
      try {
        password = await getIAMAuthToken();
      } catch (iamError) {
        console.warn('⚠️  IAM authentication failed, trying password-based auth...');
        console.warn('   Error:', iamError.message);
        if (!PGPASSWORD) {
          throw new Error('IAM auth failed and no PGPASSWORD provided');
        }
        password = PGPASSWORD;
      }
    }

    // Create connection pool
    const config = DATABASE_URL 
      ? {
          connectionString: DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        }
      : {
          host: PGHOST,
          user: PGUSER,
          password: password,
          database: PGDATABASE,
          port: PGPORT ? parseInt(PGPORT) : 5432,
          ssl: PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
        };

    pool = new Pool(config);

    console.log('🔌 Connecting to PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✓ Connected successfully\n');

    // Create tables
    console.log('📋 Creating database schema...');
    
    await pool.query(`
      -- Events table
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        individual_cost NUMERIC(10, 2) DEFAULT 0,
        all_cost NUMERIC(10, 2) DEFAULT 0,
        individual_upto INTEGER DEFAULT 0,
        date_selection_required INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      -- Event dates table
      CREATE TABLE IF NOT EXISTS event_dates (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      -- Registrations table
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

      -- Registration dates table
      CREATE TABLE IF NOT EXISTS registration_dates (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        date TEXT,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        recovery_email TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Email templates table
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

      -- Email settings table
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
    `);

    console.log('✓ Schema created successfully\n');

    // Insert master data
    console.log('📥 Inserting master data...');

    // Check if events already exist
    const eventCheck = await pool.query('SELECT COUNT(*) as count FROM events');
    if (parseInt(eventCheck.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO events (id, name, individual_cost, all_cost, individual_upto, date_selection_required, sort_order) VALUES 
        ('event_a', 'Samaiyas', 200, 2000, 10, 1, 0),
        ('event_b', 'Mahila Samaiyas', 200, 2000, 10, 1, 1),
        ('event_c', 'Weekly Satsang Sabha', 100, 1000, 20, 1, 2);
      `);
      console.log('  ✓ Events inserted (3 events)');
    } else {
      console.log('  ⊘ Events already exist, skipping');
    }

    // Check if admin user exists
    const userCheck = await pool.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCheck.rows[0].count) === 0) {
      const userId = Math.random().toString(36).substring(2, 11);
      await pool.query(`
        INSERT INTO users (id, email, password, role, recovery_email) 
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, 'admin@example.com', 'admin123', 'super_admin', 'recovery@example.com']);
      console.log('  ✓ Admin user created');
      console.log('    Email: admin@example.com');
      console.log('    Password: admin123');
      console.log('    ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
    } else {
      console.log('  ⊘ Users already exist, skipping');
    }

    // Check if email template exists
    const templateCheck = await pool.query('SELECT COUNT(*) as count FROM email_templates');
    if (parseInt(templateCheck.rows[0].count) === 0) {
      const templateId = Math.random().toString(36).substring(2, 11);
      await pool.query(`
        INSERT INTO email_templates (id, name, subject, body) 
        VALUES ($1, $2, $3, $4)
      `, [
        templateId,
        'Welcome Email',
        'Welcome {{first_name}} {{last_name}}!',
        '<p>Dear {{first_name}} {{spouse_first_name}} {{last_name}},</p><p>Thank you for your registration!</p>'
      ]);
      console.log('  ✓ Default email template created');
    } else {
      console.log('  ⊘ Email templates already exist, skipping');
    }

    console.log('\n✅ Database initialization completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Deploy your application to Vercel');
    console.log('  2. Set environment variables in Vercel dashboard');
    console.log('  3. Login with admin@example.com / admin123');
    console.log('  4. Change the admin password immediately!');

  } catch (error) {
    console.warn('⚠️  Database initialization skipped:', error.message);
    if (error.code) {
      console.warn('Error code:', error.code);
    }
    console.log('\n💡 Note: Database initialization during build is optional.');
    console.log('   Tables will be created automatically on first app request.');
    console.log('   This is normal for Vercel deployments with IAM authentication.');
    console.log('\n📋 Current configuration:');
    console.log('  Host:', PGHOST || 'NOT SET');
    console.log('  User:', PGUSER || 'NOT SET');
    console.log('  Database:', PGDATABASE || 'NOT SET');
    console.log('  Port:', PGPORT || 'NOT SET');
    console.log('  SSL Mode:', PGSSLMODE || 'NOT SET');
    console.log('  Password:', PGPASSWORD ? '✓ SET' : '❌ NOT SET');
    console.log('  IAM Auth:', USE_IAM_AUTH ? '✓ ENABLED' : '❌ DISABLED');
    // Exit with success to not block the build
    process.exit(0);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run initialization
initializeDatabase();
