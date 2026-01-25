const sql = require('mssql');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const config = {
    server: process.env.AZURE_SQL_SERVER || 'freedbserver2023.database.windows.net',
    database: process.env.AZURE_SQL_DATABASE || 'baps-sponsorship',
    user: process.env.AZURE_SQL_USER || 'sysadmin',
    password: process.env.AZURE_SQL_PASSWORD || 'Swamibapa@1921',
    port: parseInt(process.env.AZURE_SQL_PORT || '1433'),
    options: {
      encrypt: true,
      trustServerCertificate: false,
      enableArithAbort: true,
    },
  };

  try {
    console.log('Connecting to Azure SQL Database...');
    const pool = await sql.connect(config);
    console.log('Connected successfully!');

    // Read the migration file
    const migrationFile = path.join(__dirname, 'azure-sql-migration-add-event-columns.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    // Split by GO statements
    const statements = migrationSQL
      .split(/\r?\nGO\r?\n/gi)
      .map(s => s.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.match(/^--.*$/m));

    console.log(`Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);
        try {
          await pool.request().query(stmt);
          console.log('✓ Success');
        } catch (err) {
          // Ignore errors for columns that already exist
          if (err.message && err.message.includes('already exists')) {
            console.log('⚠ Column already exists, skipping...');
          } else {
            console.error('✗ Error:', err.message);
          }
        }
      }
    }

    console.log('\n✓ Migration completed successfully!');
    await pool.close();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
