// Script to export all data from SQLite to JSON for migration to PostgreSQL
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'sponsorship.db');

try {
  const db = new Database(DB_PATH);
  
  const data = {
    events: db.prepare('SELECT * FROM events').all(),
    event_dates: db.prepare('SELECT * FROM event_dates').all(),
    registrations: db.prepare('SELECT * FROM registrations').all(),
    registration_dates: db.prepare('SELECT * FROM registration_dates').all(),
    users: db.prepare('SELECT * FROM users').all(),
    email_templates: db.prepare('SELECT * FROM email_templates').all(),
    email_settings: db.prepare('SELECT * FROM email_settings').all(),
  };
  
  const exportPath = path.join(__dirname, 'sqlite-data-export.json');
  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
  
  console.log('✓ Data exported successfully to:', exportPath);
  console.log('\nExported data summary:');
  console.log('  - Events:', data.events.length);
  console.log('  - Event dates:', data.event_dates.length);
  console.log('  - Registrations:', data.registrations.length);
  console.log('  - Registration dates:', data.registration_dates.length);
  console.log('  - Users:', data.users.length);
  console.log('  - Email templates:', data.email_templates.length);
  console.log('  - Email settings:', data.email_settings.length);
  
  db.close();
} catch (error) {
  console.error('Error exporting data:', error);
  process.exit(1);
}
