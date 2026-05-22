/**
 * Test Database Connection
 * Run this to verify connection to the database server
 * Usage: node scripts/test-connection.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔄 Testing Database Connection...\n');
  console.log('Configuration:');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  Port: ${process.env.DB_PORT || 3306}`);
  console.log('');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'customer_portal',
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000
    });

    console.log('✅ Connection successful!\n');

    // Test query
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`📊 Users in database: ${rows[0].count}`);

    const [addons] = await connection.execute('SELECT COUNT(*) as count FROM addons');
    console.log(`📊 Add-ons in database: ${addons[0].count}`);

    const [workOrders] = await connection.execute('SELECT COUNT(*) as count FROM work_orders');
    console.log(`📊 Work orders in database: ${workOrders[0].count}`);

    await connection.end();
    console.log('\n✅ All tests passed! Database is accessible.');

  } catch (error) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure MySQL is running on the server PC');
    console.log('2. Check if firewall allows port 3306');
    console.log('3. Verify the IP address is correct');
    console.log('4. Ensure the user has remote access permissions');
  }
}

testConnection();
