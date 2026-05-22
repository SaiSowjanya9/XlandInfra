/**
 * Backup Railway MySQL Database
 * Run: node scripts/backup-railway.js
 * 
 * Set these environment variables first:
 * - DB_HOST (from Railway)
 * - DB_USER (from Railway)
 * - DB_PASSWORD (from Railway)
 * - DB_NAME (from Railway)
 * - DB_PORT (from Railway)
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const backupDir = path.join(__dirname, '../backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().split('T')[0];
const filename = `backup_${timestamp}.sql`;
const filepath = path.join(backupDir, filename);

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT = 3306
} = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  console.error('❌ Missing database credentials in .env file');
  console.log('Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  process.exit(1);
}

console.log('📦 Starting backup...');
console.log(`   Host: ${DB_HOST}`);
console.log(`   Database: ${DB_NAME}`);
console.log(`   Output: ${filepath}`);

const command = `mysqldump -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > "${filepath}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Backup failed:', error.message);
    console.log('\nMake sure mysqldump is installed:');
    console.log('  Windows: Install MySQL client tools');
    console.log('  Mac: brew install mysql-client');
    console.log('  Linux: apt install mysql-client');
    return;
  }
  
  const stats = fs.statSync(filepath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`\n✅ Backup successful!`);
  console.log(`   File: ${filepath}`);
  console.log(`   Size: ${sizeMB} MB`);
});
