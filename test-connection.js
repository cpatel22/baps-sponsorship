// Quick connection test for AWS RDS
const { Client } = require('pg');

const PGHOST = process.env.PGHOST || process.env.bapsorlando_PGHOST;
const PGUSER = process.env.PGUSER || process.env.bapsorlando_PGUSER;
const PGDATABASE = process.env.PGDATABASE || process.env.bapsorlando_PGDATABASE;
const PGPASSWORD = process.env.PGPASSWORD || process.env.bapsorlando_PGPASSWORD;
const PGPORT = process.env.PGPORT || process.env.bapsorlando_PGPORT;
const PGSSLMODE = process.env.PGSSLMODE || process.env.bapsorlando_PGSSLMODE;

async function testConnection() {
  console.log('🔍 Testing AWS RDS Connection...\n');
  console.log('Configuration:');
  console.log('  Host:', PGHOST);
  console.log('  Port:', PGPORT);
  console.log('  Database:', PGDATABASE);
  console.log('  User:', PGUSER);
  console.log('  SSL Mode:', PGSSLMODE);
  console.log('  Password:', PGPASSWORD ? '✓ SET (length: ' + PGPASSWORD.length + ')' : '❌ NOT SET');
  console.log('');

  if (!PGPASSWORD) {
    console.error('❌ Password is not set!');
    console.log('\n📝 Please update .env.local with:');
    console.log('   bapsorlando_PGPASSWORD="your-actual-password"');
    process.exit(1);
  }

  const client = new Client({
    host: PGHOST,
    port: parseInt(PGPORT),
    database: PGDATABASE,
    user: PGUSER,
    password: PGPASSWORD,
    ssl: PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('🔌 Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    const result = await client.query('SELECT NOW(), version()');
    console.log('✓ Server time:', result.rows[0].now);
    console.log('✓ PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    console.log('\n✅ Connection test PASSED!');
    console.log('\n📝 Next step: Run "bun run db:init" to create tables');
    
  } catch (error) {
    console.error('\n❌ Connection test FAILED!\n');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    console.log('\n🔍 Troubleshooting:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n❌ Connection Refused - Possible causes:');
      console.log('  1. Security Group not allowing your IP');
      console.log('  2. Database is not publicly accessible');
      console.log('  3. Wrong hostname or port');
      console.log('\n✅ Solutions:');
      console.log('  • Go to AWS RDS Console → baps-sponsorship');
      console.log('  • Click "VPC security groups"');
      console.log('  • Edit inbound rules → Add rule:');
      console.log('    - Type: PostgreSQL (5432)');
      console.log('    - Source: My IP (or 0.0.0.0/0 for testing)');
      console.log('  • Check "Publicly accessible" is set to "Yes"');
      
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n❌ Hostname not found:');
      console.log('  • Check the hostname is correct');
      console.log('  • Current:', PGHOST);
      
    } else if (error.code === '28P01') {
      console.log('\n❌ Authentication Failed:');
      console.log('  • Password is incorrect');
      console.log('  • Or username is wrong');
      console.log('\n✅ Solution: Reset password in AWS RDS Console');
      
    } else if (error.code === '3D000') {
      console.log('\n❌ Database does not exist:');
      console.log('  • The database "postgres" may not exist');
      console.log('  • Try connecting to "template1" or create the database');
      
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n❌ Connection Timeout:');
      console.log('  • Network issue or firewall blocking');
      console.log('  • Security group not configured');
      console.log('  • VPC/subnet configuration issue');
    }
    
    console.log('\n💡 Common AWS RDS Setup Checklist:');
    console.log('  [ ] Security group allows inbound port 5432');
    console.log('  [ ] "Publicly accessible" is set to Yes');
    console.log('  [ ] Master password is correct');
    console.log('  [ ] You are connecting from an allowed IP');
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
