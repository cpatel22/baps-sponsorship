import { Pool, QueryResult } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

// Support multiple environment variable formats (Vercel, Railway, custom)
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Support Vercel Postgres individual environment variables
const PGHOST = process.env.PGHOST || process.env.bapsorlando_PGHOST;
const PGUSER = process.env.PGUSER || process.env.bapsorlando_PGUSER;
const PGDATABASE = process.env.PGDATABASE || process.env.bapsorlando_PGDATABASE;
const PGPASSWORD = process.env.PGPASSWORD || process.env.bapsorlando_PGPASSWORD;
const PGPORT = process.env.PGPORT || process.env.bapsorlando_PGPORT;
const PGSSLMODE = process.env.PGSSLMODE || process.env.bapsorlando_PGSSLMODE;

// AWS IAM authentication (for Vercel Postgres on Aurora)
const AWS_REGION = process.env.AWS_REGION || process.env.bapsorlando_AWS_REGION;
const USE_IAM_AUTH = process.env.bapsorlando_AWS_ROLE_ARN && !PGPASSWORD;

let pool: Pool | null = null;
let initialized = false;

// Generate IAM auth token for RDS
async function getIAMAuthToken(): Promise<string> {
  if (!USE_IAM_AUTH || !PGHOST || !PGUSER || !AWS_REGION) {
    throw new Error('IAM authentication requires PGHOST, PGUSER, and AWS_REGION');
  }

  const signer = new Signer({
    hostname: PGHOST,
    port: PGPORT ? parseInt(PGPORT) : 5432,
    username: PGUSER,
    region: AWS_REGION,
  });

  return await signer.getAuthToken();
}

// Get PostgreSQL connection pool
function getPool(): Pool {
  if (pool) return pool;
  
  // Build connection config - prefer individual vars (Vercel style) over connection string
  const config = DATABASE_URL 
    ? {
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: PGHOST,
        user: PGUSER,
        password: PGPASSWORD, // Will be overridden by IAM token if USE_IAM_AUTH
        database: PGDATABASE,
        port: PGPORT ? parseInt(PGPORT) : 5432,
        ssl: PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
      };
  
  pool = new Pool({
    ...config,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Override password getter for IAM authentication
  if (USE_IAM_AUTH) {
    const originalConnect = pool.connect.bind(pool);
    pool.connect = async (...args: any[]) => {
      // Generate fresh IAM token for each connection
      const token = await getIAMAuthToken();
      if (pool) {
        (pool as any).options.password = token;
      }
      return originalConnect(...args);
    };
  }
  
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
  
  return pool;
}

// Initialize database on first connection
async function initializeDB() {
  if (initialized) return;
  
  const pool = getPool();
  await initializeSchema(pool);
  await seed(pool);
  initialized = true;
}

// Database wrapper with auto-initialization
class DatabaseWrapper {
  private async ensureInitialized() {
    await initializeDB();
  }

  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    await this.ensureInitialized();
    const pool = getPool();
    return pool.query<T>(text, params);
  }

  async get<T = any>(text: string, params?: any[]): Promise<T | undefined> {
    await this.ensureInitialized();
    const result = await this.query<T>(text, params);
    return result.rows[0];
  }

  async all<T = any>(text: string, params?: any[]): Promise<T[]> {
    await this.ensureInitialized();
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  async run(text: string, params?: any[]): Promise<void> {
    await this.ensureInitialized();
    await this.query(text, params);
  }

  async getPool(): Promise<Pool> {
    await this.ensureInitialized();
    return getPool();
  }
}

// Initialize database schema
async function initializeSchema(pool: Pool) {
  await pool.query(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    individual_cost NUMERIC(10, 2) DEFAULT 0,
    all_cost NUMERIC(10, 2) DEFAULT 0,
    individual_upto INTEGER DEFAULT 0,
    date_selection_required INTEGER DEFAULT 1,
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
`);
}

// Seed initial events and super admin if they don't exist
async function seed(pool: Pool) {
  const eventCountResult = await pool.query('SELECT COUNT(*) as count FROM events');
  const eventCount = parseInt(eventCountResult.rows[0].count);
  
  if (eventCount === 0) {
    await pool.query('INSERT INTO events (id, name, individual_cost, all_cost, individual_upto, date_selection_required, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', ['event_a', 'Samaiyas', 200, 2000, 10, 1, 0]);
    await pool.query('INSERT INTO events (id, name, individual_cost, all_cost, individual_upto, date_selection_required, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', ['event_b', 'Mahila Samaiyas', 200, 2000, 10, 1, 1]);
    await pool.query('INSERT INTO events (id, name, individual_cost, all_cost, individual_upto, date_selection_required, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)', ['event_c', 'Weekly Satsang Sabha', 100, 1000, 20, 1, 2]);
  }

  const userCountResult = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(userCountResult.rows[0].count);
  
  if (userCount === 0) {
    // Initial user: admin@example.com / admin123
    const userId = Math.random().toString(36).substring(2, 11);
    await pool.query(
      'INSERT INTO users (id, email, password, role, recovery_email) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'admin@example.com', 'admin123', 'super_admin', 'recovery@example.com']
    );
  }
}

// Export the database wrapper
export default new DatabaseWrapper();
