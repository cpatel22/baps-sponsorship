// Script to import SQLite data into PostgreSQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL or POSTGRES_URL environment variable is required');
  console.log('\nPlease set your PostgreSQL connection string:');
  console.log('  export DATABASE_URL="postgresql://user:password@host:port/database"');
  console.log('\nFor Amazon Aurora PostgreSQL:');
  console.log('  export DATABASE_URL="postgresql://user:password@your-cluster.region.rds.amazonaws.com:5432/database"');
  process.exit(1);
}

async function importData() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL');

    // Read exported data
    const dataPath = path.join(__dirname, 'sqlite-data-export.json');
    if (!fs.existsSync(dataPath)) {
      console.error('Error: sqlite-data-export.json not found');
      console.log('Please run: node export-sqlite-data.js first');
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log('\n📥 Importing data...');

    // Import events
    if (data.events && data.events.length > 0) {
      console.log(`  Importing ${data.events.length} events...`);
      for (const event of data.events) {
        await pool.query(
          'INSERT INTO events (id, name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET name = $2, sort_order = $3',
          [event.id, event.name, event.sortOrder || 0]
        );
      }
      console.log('  ✓ Events imported');
    }

    // Import event_dates
    if (data.event_dates && data.event_dates.length > 0) {
      console.log(`  Importing ${data.event_dates.length} event dates...`);
      for (const eventDate of data.event_dates) {
        await pool.query(
          'INSERT INTO event_dates (id, event_id, date, title) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET event_id = $2, date = $3, title = $4',
          [eventDate.id, eventDate.event_id, eventDate.date, eventDate.title || null]
        );
      }
      console.log('  ✓ Event dates imported');
    }

    // Import registrations
    if (data.registrations && data.registrations.length > 0) {
      console.log(`  Importing ${data.registrations.length} registrations...`);
      for (const reg of data.registrations) {
        await pool.query(
          'INSERT INTO registrations (id, first_name, spouse_first_name, last_name, address, phone, email, sponsorship_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET first_name = $2, spouse_first_name = $3, last_name = $4, address = $5, phone = $6, email = $7, sponsorship_type = $8',
          [reg.id, reg.first_name, reg.spouse_first_name, reg.last_name, reg.address, reg.phone, reg.email, reg.sponsorship_type, reg.created_at]
        );
      }
      console.log('  ✓ Registrations imported');
    }

    // Import registration_dates
    if (data.registration_dates && data.registration_dates.length > 0) {
      console.log(`  Importing ${data.registration_dates.length} registration dates...`);
      for (const regDate of data.registration_dates) {
        await pool.query(
          'INSERT INTO registration_dates (id, registration_id, event_id, date, quantity) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET registration_id = $2, event_id = $3, date = $4, quantity = $5',
          [regDate.id, regDate.registration_id, regDate.event_id, regDate.date, regDate.quantity || 1]
        );
      }
      console.log('  ✓ Registration dates imported');
    }

    // Import users
    if (data.users && data.users.length > 0) {
      console.log(`  Importing ${data.users.length} users...`);
      for (const user of data.users) {
        try {
          await pool.query(
            'INSERT INTO users (id, email, password, role, recovery_email, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO UPDATE SET password = $3, role = $4, recovery_email = $5',
            [user.id, user.email, user.password, user.role, user.recovery_email, user.created_at]
          );
        } catch (err) {
          console.log(`    Warning: Skipped duplicate user: ${user.email}`);
        }
      }
      console.log('  ✓ Users imported');
    }

    // Import email_templates
    if (data.email_templates && data.email_templates.length > 0) {
      console.log(`  Importing ${data.email_templates.length} email templates...`);
      for (const template of data.email_templates) {
        await pool.query(
          'INSERT INTO email_templates (id, name, to_field, cc_field, bcc_field, subject, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET name = $2, to_field = $3, cc_field = $4, bcc_field = $5, subject = $6, body = $7, updated_at = $9',
          [template.id, template.name, template.to_field || '{{email}}', template.cc_field, template.bcc_field, template.subject, template.body, template.created_at, template.updated_at]
        );
      }
      console.log('  ✓ Email templates imported');
    }

    // Import email_settings
    if (data.email_settings && data.email_settings.length > 0) {
      console.log(`  Importing ${data.email_settings.length} email settings...`);
      for (const settings of data.email_settings) {
        await pool.query(
          'INSERT INTO email_settings (id, email_from, smtp_server, smtp_port_tls, smtp_port_ssl, smtp_username, smtp_password, connection_security, reply_to_email, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO UPDATE SET email_from = $2, smtp_server = $3, smtp_port_tls = $4, smtp_port_ssl = $5, smtp_username = $6, smtp_password = $7, connection_security = $8, reply_to_email = $9, updated_at = $10',
          [settings.id, settings.email_from, settings.smtp_server, settings.smtp_port_tls, settings.smtp_port_ssl, settings.smtp_username, settings.smtp_password, settings.connection_security, settings.reply_to_email, settings.updated_at]
        );
      }
      console.log('  ✓ Email settings imported');
    }

    console.log('\n✅ Data migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importData();
