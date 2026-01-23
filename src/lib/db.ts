import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'sponsorship.db');

const db = new Database(DB_PATH);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_dates (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    date TEXT NOT NULL,
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    to_field TEXT DEFAULT '{{email}}',
    cc_field TEXT,
    bcc_field TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add columns to existing email_templates table if they don't exist
try {
  db.exec(`
    ALTER TABLE email_templates ADD COLUMN to_field TEXT DEFAULT '{{email}}';
  `);
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.exec(`
    ALTER TABLE email_templates ADD COLUMN cc_field TEXT;
  `);
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.exec(`
    ALTER TABLE email_templates ADD COLUMN bcc_field TEXT;
  `);
} catch (e) {
  // Column already exists, ignore error
}

// Migrate registration_dates table to make date nullable and add quantity
try {
  // Check if the old schema exists (date is NOT NULL)
  const tableInfo = db.prepare("PRAGMA table_info(registration_dates)").all() as any[];
  const dateColumn = tableInfo.find((col: any) => col.name === 'date');
  const quantityColumn = tableInfo.find((col: any) => col.name === 'quantity');
  
  // If date is NOT NULL or quantity doesn't exist, recreate the table
  if ((dateColumn && dateColumn.notnull === 1) || !quantityColumn) {
    db.exec(`
      -- Create new table with correct schema
      CREATE TABLE IF NOT EXISTS registration_dates_new (
        id TEXT PRIMARY KEY,
        registration_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        date TEXT,
        quantity INTEGER DEFAULT 1,
        FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );
      
      -- Copy existing data
      INSERT INTO registration_dates_new (id, registration_id, event_id, date, quantity)
      SELECT id, registration_id, event_id, date, 
             COALESCE((SELECT quantity FROM registration_dates rd2 WHERE rd2.id = registration_dates.id), 1)
      FROM registration_dates;
      
      -- Drop old table
      DROP TABLE registration_dates;
      
      -- Rename new table
      ALTER TABLE registration_dates_new RENAME TO registration_dates;
    `);
  }
} catch (e) {
  console.log('Registration_dates migration skipped or already applied:', e);
}

// Seed initial events and super admin if they don't exist
const seed = () => {
  const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
  if (eventCount.count === 0) {
    const insert = db.prepare('INSERT INTO events (id, name) VALUES (?, ?)');
    insert.run('event_a', 'Samaiyas');
    insert.run('event_b', 'Mahila Samaiyas');
    insert.run('event_c', 'Weekly Satsang Sabha');
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insert = db.prepare('INSERT INTO users (id, email, password, role, recovery_email) VALUES (?, ?, ?, ?, ?)');
    // Initial user: admin@example.com / admin123
    insert.run(
      Math.random().toString(36).substring(2, 11),
      'admin@example.com',
      'admin123', // In a real app, use bcrypt here
      'super_admin',
      'recovery@example.com'
    );
  }
};

seed();

export default db;
