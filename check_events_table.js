const sql = require('mssql');

async function checkColumns() {
  const config = {
    server: 'freedbserver2023.database.windows.net',
    database: 'baps-sponsorship',
    user: 'sysadmin',
    password: 'Swamibapa@1921',
    port: 1433,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  };

  try {
    const pool = await sql.connect(config);
    
    // Check columns
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME='events' 
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('\nColumns in events table:');
    cols.recordset.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.DATA_TYPE})`));
    
    // Check data
    const events = await pool.request().query('SELECT * FROM dbo.events ORDER BY sortOrder ASC');
    console.log('\nEvents data:');
    console.log(JSON.stringify(events.recordset, null, 2));
    
    await pool.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkColumns();
