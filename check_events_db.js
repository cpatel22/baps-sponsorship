const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(), 'sponsorship.db'));
const info = db.prepare('PRAGMA table_info(events)').all();
console.log(info);
