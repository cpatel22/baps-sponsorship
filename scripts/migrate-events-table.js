// Migration script to add missing columns to events table
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

async function getIAMAuthToken() {
  const signer = new Signer({
    hostname: PGHOST,
    port: PGPORT ? parseInt(PGPORT) : 5432,
    username: PGUSER,
    region: AWS_REGION,
  });
  return await signer.getAuthToken();
}

async function migrateDatabase() {
  let pool;
  
  try {
    let password = PGPASSWORD;
    if (USE_IAM_AUTH) {
      console.log('🔐 Using AWS IAM authentication...');
      password = await getIAMAuthToken();
    }

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

    console.log('🔄 Migrating events table...');
    
    // Check which columns exist
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events'
    `);
    
    const existingColumns = columnsResult.rows.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumns.join(', '));
    
    // Add missing columns
    const columnsToAdd = [
      { name: 'individual_cost', type: 'NUMERIC(10, 2) DEFAULT 0' },
      { name: 'all_cost', type: 'NUMERIC(10, 2) DEFAULT 0' },
      { name: 'individual_upto', type: 'INTEGER DEFAULT 0' },
      { name: 'date_selection_required', type: 'INTEGER DEFAULT 1' }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`  ➕ Adding column: ${column.name}`);
        await pool.query(`ALTER TABLE events ADD COLUMN ${column.name} ${column.type}`);
      } else {
        console.log(`  ⊘ Column ${column.name} already exists, skipping`);
      }
    }
    
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

migrateDatabase();
