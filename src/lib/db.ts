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
    date TEXT NOT NULL,
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
`);

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
