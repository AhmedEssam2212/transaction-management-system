const { Client } = require('pg');

async function createDatabase() {
  // Connect to postgres database to create the audit_log_db
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'txg',
    password: 'txg',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    
    // Check if database exists
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'audit_log_db'"
    );
    
    if (result.rows.length === 0) {
      // Create the database
      await client.query('CREATE DATABASE audit_log_db');
      console.log('✅ Database audit_log_db created successfully');
    } else {
      console.log('ℹ️  Database audit_log_db already exists');
    }
  } catch (error) {
    console.error('Error creating database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();

