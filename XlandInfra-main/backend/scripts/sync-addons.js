/**
 * Quick Sync Script - Specifically for Add-ons
 * This syncs only the addons table
 * Usage: node scripts/sync-addons.js
 */

const mysql = require('mysql2/promise');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, resolve));
}

async function syncAddons() {
  console.log('🔄 Add-ons Sync Tool\n');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_portal',
    port: process.env.DB_PORT || 3306
  });

  try {
    // Show current addons
    const [addons] = await pool.execute('SELECT id, name, property_type, total_rate FROM addons ORDER BY id');
    
    console.log('📋 Current Add-ons in this database:\n');
    console.log('ID | Name | Property Type | Rate');
    console.log('---|------|---------------|-----');
    
    if (addons.length === 0) {
      console.log('(No add-ons found)');
    } else {
      addons.forEach(a => {
        console.log(`${a.id} | ${a.name} | ${a.property_type || '-'} | ₹${a.total_rate}`);
      });
    }
    
    console.log(`\nTotal: ${addons.length} add-ons\n`);
    
    const action = await question('What would you like to do?\n1. Export add-ons to file\n2. Import add-ons from file\n3. Manual add missing add-on\n\nEnter choice (1/2/3): ');
    
    if (action === '1') {
      // Export
      const fs = require('fs');
      const path = require('path');
      const exportDir = path.join(__dirname, '../exports');
      if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });
      
      const filepath = path.join(exportDir, 'addons_export.json');
      fs.writeFileSync(filepath, JSON.stringify(addons, null, 2));
      console.log(`\n✅ Exported to: ${filepath}`);
      console.log('Copy this file to the other PC and run option 2 to import.');
      
    } else if (action === '2') {
      // Import
      const fs = require('fs');
      const path = require('path');
      const filepath = path.join(__dirname, '../exports/addons_export.json');
      
      if (!fs.existsSync(filepath)) {
        console.log(`\n❌ File not found: ${filepath}`);
        console.log('Place the addons_export.json file in backend/exports/ folder');
      } else {
        const importData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        let imported = 0;
        
        for (const addon of importData) {
          try {
            const columns = Object.keys(addon);
            const values = Object.values(addon);
            const placeholders = columns.map(() => '?').join(', ');
            const updateClause = columns.map(col => `${col} = VALUES(${col})`).join(', ');
            
            await pool.execute(
              `INSERT INTO addons (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
              values
            );
            imported++;
          } catch (err) {
            console.log(`⚠️  Skipped: ${addon.name}`);
          }
        }
        
        console.log(`\n✅ Imported ${imported} add-ons!`);
      }
      
    } else if (action === '3') {
      // Manual add
      console.log('\n📝 Enter add-on details:');
      const name = await question('Name: ');
      const propertyType = await question('Property Type (gated_community/apartment/villa/flat/plot): ');
      const frequency = await question('Frequency (monthly/quarterly/yearly/custom): ');
      const count = await question('Count: ');
      const totalRate = await question('Total Rate: ');
      
      await pool.execute(
        `INSERT INTO addons (name, property_type, frequency, count, total_rate, is_active, created_at) 
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [name, propertyType, frequency, parseInt(count), parseFloat(totalRate)]
      );
      
      console.log('\n✅ Add-on created!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

syncAddons();
