const { pool } = require('../config/database');

/**
 * How a `clients` row points at the property it belongs to, and who created it.
 *
 * `clients` was built for the `properties` table and still carries its shape:
 *
 *   `property_id` int  FOREIGN KEY -> properties(id)  ON DELETE SET NULL
 *   `created_by`  int  FOREIGN KEY -> users(id)       ON DELETE SET NULL
 *
 * The Manager / Coordinator / Supervisor / Executive Add Customer writes its property to
 * **`onboarded_properties`**, then wrote that row's id into `property_id` and its own *username*
 * into `created_by`. Both are rejected -- the id fails the foreign key, and the username fails the
 * column's type ("Incorrect integer value: 'test-manager-969675_mvphja5o' for column
 * 'created_by'") -- so the INSERT failed and the surrounding catch retried it with **both set to
 * NULL**. Nothing surfaced: the request still answered 201.
 *
 * The cost was a Customers screen that could never show a row. The reader claims a client on two
 * grounds -- the zone of its joined property, or `created_by` being this user -- and the retry had
 * emptied the columns both grounds read, so neither could ever match. A manager added a customer,
 * was told it had been created, and the list stayed empty for good.
 *
 * `property_code` is the fix, for the same reason `work_orders` has one: `properties.id` 37 and
 * `onboarded_properties.id` 37 are two different communities, so a bare row number cannot name a
 * property, while `GC-…` / `APT-…` / `V-…` / `PL-…` / `FL-…` is unique across both. It carries no
 * foreign key, so it can hold a property from either table.
 *
 * DDL commits implicitly in MySQL, so callers must await this BEFORE opening a transaction.
 */

const COLUMNS = {
  // schema_v63_clients_property_code.sql -- the property's unique code, from either table
  property_code: 'VARCHAR(50) NULL'
};

let ensured = null;

/** The columns `clients` has, after adding whatever was missing and could be added. */
const ensureClientColumns = () => {
  if (!ensured) {
    ensured = (async () => {
      const [rows] = await pool.execute(
        `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients'`
      );
      const existing = new Set(rows.map(row => row.name));
      for (const [column, definition] of Object.entries(COLUMNS)) {
        if (existing.has(column)) continue;
        try {
          await pool.execute(`ALTER TABLE clients ADD COLUMN ${column} ${definition}`);
          existing.add(column);
          console.log(`[clients] added ${column}; schema_v63_clients_property_code had not been applied`);
        } catch (error) {
          console.warn(`[clients] could not add ${column} (${error.message}). ` +
            'Apply backend/database/migrations/schema_v63_clients_property_code.sql; until then ' +
            'the column is left out of the write rather than failing it.');
        }
      }
      return existing;
    })().catch(error => {
      // Do not cache a failed pass: the next write tries again rather than staying broken
      ensured = null;
      console.warn(`[clients] column check failed (${error.message})`);
      return new Set();
    });
  }
  return ensured;
};

/**
 * The creator to store in `clients.created_by`, which is an int keyed on `users(id)`.
 *
 * A username or email here fails the column outright. Anything that is not a positive integer
 * becomes NULL: losing who created the row is survivable, losing the row is not.
 */
const clientCreatedBy = (user) => {
  const id = Number.parseInt(user?.id, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

/**
 * The property reference to store, as the column list and values to splice into an INSERT.
 *
 * `property_id` is only sent where the number really is a `properties` row -- that is the one
 * thing its foreign key accepts. For a property in `onboarded_properties` the number is dropped
 * and the code carries the link, because a number that exists in both tables under different
 * codes would otherwise hand the client to the wrong community.
 */
const clientPropertyColumns = async ({ propertyCode = null, propertyId = null, sourceTable = null } = {}) => {
  const columns = await ensureClientColumns();
  const names = [];
  const values = [];

  const numericId = Number.parseInt(propertyId, 10);
  const isRegularProperty = sourceTable === 'properties';
  if (isRegularProperty && Number.isSafeInteger(numericId) && numericId > 0) {
    names.push('property_id');
    values.push(numericId);
  }
  if (columns.has('property_code') && propertyCode) {
    names.push('property_code');
    values.push(propertyCode);
  }
  return { names, values };
};

/**
 * The SELECT list and JOINs that resolve a client's property name and zone from either table.
 *
 * Where `property_code` is absent -- a database the ALTER could not reach -- the code join is left
 * out rather than named, because naming a missing column fails the whole statement and would empty
 * the screen instead of degrading it to the old number-only behaviour.
 */
const clientPropertyJoin = async ({ clientAlias = 'c', onboardedAlias = 'op', propertyAlias = 'p' } = {}) => {
  const columns = await ensureClientColumns();
  const hasCode = columns.has('property_code');
  const codeMatch = hasCode
    ? `${onboardedAlias}.property_id = ${clientAlias}.property_code OR `
    : '';
  return {
    hasCode,
    joins: `LEFT JOIN onboarded_properties ${onboardedAlias}
              ON ${codeMatch}${onboardedAlias}.id = ${clientAlias}.property_id
            LEFT JOIN properties ${propertyAlias}
              ON ${propertyAlias}.id = ${clientAlias}.property_id`,
    nameExpression: `COALESCE(${onboardedAlias}.community_name, ${propertyAlias}.name)`,
    zoneExpression: `COALESCE(${onboardedAlias}.zone, ${propertyAlias}.zone_id)`
  };
};

// Tests need to forget what we learned about the table
const resetClientColumnsCache = () => { ensured = null; };

module.exports = {
  ensureClientColumns,
  clientCreatedBy,
  clientPropertyColumns,
  clientPropertyJoin,
  resetClientColumnsCache
};
