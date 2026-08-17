/**
 * Migration script to populate block_unit_types for existing GC and APT properties
 * Run this script with: node database/populate_block_unit_types.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'customer_portal',
    waitForConnections: true,
    connectionLimit: 10
  });

  console.log('🔄 Starting block_unit_types migration...\n');

  try {
    // Ensure columns exist in properties table
    console.log('📋 Ensuring block columns exist in properties table...');
    const alterQueries = [
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_unit_types JSON DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS number_of_blocks INT DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_names JSON DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS units_per_block JSON DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_info VARCHAR(255) DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS block_na TINYINT(1) DEFAULT 0',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS flat_block_info VARCHAR(255) DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS flat_block_na TINYINT(1) DEFAULT 0',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS villa_plot_number VARCHAR(100) DEFAULT NULL',
      'ALTER TABLE properties ADD COLUMN IF NOT EXISTS plot_na TINYINT(1) DEFAULT 0'
    ];

    for (const query of alterQueries) {
      try {
        await pool.execute(query);
      } catch (e) {
        // Column likely already exists
      }
    }
    console.log('✅ Column check complete\n');

    // 1. Fix GC properties in onboarded_properties table
    console.log('🏘️ Processing Gated Community properties in onboarded_properties...');
    const [gcOnboarded] = await pool.execute(
      `SELECT id, property_id, community_name, number_of_blocks, units_per_block, block_unit_types 
       FROM onboarded_properties 
       WHERE (entry_type = 'GC' OR property_type = 'gated_community') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')
       AND units_per_block IS NOT NULL`
    );

    console.log(`   Found ${gcOnboarded.length} GC properties needing block_unit_types\n`);

    for (const prop of gcOnboarded) {
      try {
        let unitsPerBlock = prop.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          unitsPerBlock = JSON.parse(unitsPerBlock);
        }

        // Create blockUnitTypes structure with empty unit types for each block
        const blockUnitTypes = {};
        const numBlocks = prop.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;

        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          };
        }

        await pool.execute(
          'UPDATE onboarded_properties SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), prop.id]
        );
        console.log(`   ✅ Updated GC: ${prop.community_name || prop.property_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${prop.property_id}: ${e.message}`);
      }
    }

    // 2. Fix APT properties in onboarded_properties table
    console.log('\n🏢 Processing Apartment properties in onboarded_properties...');
    const [aptOnboarded] = await pool.execute(
      `SELECT id, property_id, community_name, number_of_units, block_unit_types 
       FROM onboarded_properties 
       WHERE (entry_type = 'APT' OR property_type = 'apartment') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')`
    );

    console.log(`   Found ${aptOnboarded.length} APT properties needing block_unit_types\n`);

    for (const prop of aptOnboarded) {
      try {
        // Create blockUnitTypes structure with 'apt' key
        const blockUnitTypes = {
          apt: {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          }
        };

        await pool.execute(
          'UPDATE onboarded_properties SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), prop.id]
        );
        console.log(`   ✅ Updated APT: ${prop.community_name || prop.property_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${prop.property_id}: ${e.message}`);
      }
    }

    // 3. Fix GC properties in properties table
    console.log('\n🏘️ Processing Gated Community properties in properties table...');
    const [gcProperties] = await pool.execute(
      `SELECT id, property_id, name, number_of_blocks, units_per_block, block_unit_types 
       FROM properties 
       WHERE (property_type = 'gated_community' OR property_type = 'GC') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')`
    );

    console.log(`   Found ${gcProperties.length} GC properties needing block_unit_types\n`);

    for (const prop of gcProperties) {
      try {
        let unitsPerBlock = prop.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          try {
            unitsPerBlock = JSON.parse(unitsPerBlock);
          } catch (e) {
            unitsPerBlock = {};
          }
        }

        const blockUnitTypes = {};
        const numBlocks = prop.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;

        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          };
        }

        await pool.execute(
          'UPDATE properties SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), prop.id]
        );
        console.log(`   ✅ Updated GC: ${prop.name || prop.property_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${prop.property_id}: ${e.message}`);
      }
    }

    // 4. Fix APT properties in properties table
    console.log('\n🏢 Processing Apartment properties in properties table...');
    const [aptProperties] = await pool.execute(
      `SELECT id, property_id, name, number_of_units, block_unit_types 
       FROM properties 
       WHERE (property_type = 'apartment' OR property_type = 'APT') 
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')`
    );

    console.log(`   Found ${aptProperties.length} APT properties needing block_unit_types\n`);

    for (const prop of aptProperties) {
      try {
        const blockUnitTypes = {
          apt: {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          }
        };

        await pool.execute(
          'UPDATE properties SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), prop.id]
        );
        console.log(`   ✅ Updated APT: ${prop.name || prop.property_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${prop.property_id}: ${e.message}`);
      }
    }

    // 5. Fix fp_estimates table for GC estimates
    console.log('\n📝 Processing GC estimates in fp_estimates table...');
    const [gcEstimates] = await pool.execute(
      `SELECT id, estimate_id, property_name, number_of_blocks, units_per_block, block_unit_types 
       FROM fp_estimates 
       WHERE (property_type = 'gated_community' OR property_type = 'GC')
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')
       AND units_per_block IS NOT NULL`
    );

    console.log(`   Found ${gcEstimates.length} GC estimates needing block_unit_types\n`);

    for (const est of gcEstimates) {
      try {
        let unitsPerBlock = est.units_per_block;
        if (typeof unitsPerBlock === 'string') {
          unitsPerBlock = JSON.parse(unitsPerBlock);
        }

        const blockUnitTypes = {};
        const numBlocks = est.number_of_blocks || Object.keys(unitsPerBlock || {}).length || 1;

        for (let i = 1; i <= numBlocks; i++) {
          blockUnitTypes[i] = {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          };
        }

        await pool.execute(
          'UPDATE fp_estimates SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), est.id]
        );
        console.log(`   ✅ Updated GC estimate: ${est.estimate_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${est.estimate_id}: ${e.message}`);
      }
    }

    // 6. Fix fp_estimates table for APT estimates
    console.log('\n📝 Processing APT estimates in fp_estimates table...');
    const [aptEstimates] = await pool.execute(
      `SELECT id, estimate_id, property_name, block_unit_types 
       FROM fp_estimates 
       WHERE (property_type = 'apartment' OR property_type = 'APT')
       AND (block_unit_types IS NULL OR block_unit_types = '{}' OR block_unit_types = 'null')`
    );

    console.log(`   Found ${aptEstimates.length} APT estimates needing block_unit_types\n`);

    for (const est of aptEstimates) {
      try {
        const blockUnitTypes = {
          apt: {
            studio: 0,
            oneBed: 0,
            twoBed: 0,
            threeBed: 0,
            fourBed: 0
          }
        };

        await pool.execute(
          'UPDATE fp_estimates SET block_unit_types = ? WHERE id = ?',
          [JSON.stringify(blockUnitTypes), est.id]
        );
        console.log(`   ✅ Updated APT estimate: ${est.estimate_id}`);
      } catch (e) {
        console.log(`   ⚠️ Error updating ${est.estimate_id}: ${e.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('Note: Unit type breakdowns (Studio, 1BHK, 2BHK, etc.) are initialized to 0.');
    console.log('Users can edit properties to add the actual bedroom counts.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

migrate();
