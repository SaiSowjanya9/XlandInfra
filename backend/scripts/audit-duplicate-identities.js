/**
 * Audit and repair duplicate login identities.
 *
 * One email must resolve to one login identity. An email that exists in more
 * than one of {users, franchise_partners, fp_employees} with different password
 * hashes is the bug that locked rsbhavani1 out of every portal: each login route
 * picked the first row it found and the correct password failed against the
 * wrong hash.
 *
 * Classifications:
 *   PAIR      users + franchise_partners where users.role is franchise_partner/
 *             franchise — the designed dual-write from staff creation. Kept.
 *             Flagged only when the two hashes differ (run a password reset to
 *             resync, or deactivate the users row if the FP portal alone is
 *             wanted).
 *   ANOMALY   users + franchise_partners with a staff role — a second identity
 *             for an FP owner. --apply deactivates the users row.
 *   FP_AS_EMP franchise_partners + fp_employees — an owner listed as someone's
 *             employee. --apply deactivates the fp_employees row.
 *   SHADOW    users + fp_employees where fp_employees.user_id IS NULL — an
 *             unlinked employee record carrying its own password. --apply
 *             deactivates the fp_employees row.
 *
 * users + fp_employees WITH user_id set is the normal linked pair — skipped.
 *
 * Usage:
 *   node backend/scripts/audit-duplicate-identities.js          # dry run
 *   node backend/scripts/audit-duplicate-identities.js --apply  # deactivate non-canonical rows
 */

const { pool } = require('../config/database');

const APPLY = process.argv.includes('--apply');

async function main() {
  const [rows] = await pool.execute(`
    SELECT email,
           GROUP_CONCAT(DISTINCT src ORDER BY src) AS sources,
           COUNT(DISTINCT src) AS source_count
    FROM (
      SELECT LOWER(email) AS email, 'users'              AS src FROM users              WHERE email IS NOT NULL AND email != ''
      UNION ALL
      SELECT LOWER(email) AS email, 'franchise_partners' AS src FROM franchise_partners WHERE email IS NOT NULL AND email != ''
      UNION ALL
      SELECT LOWER(email) AS email, 'fp_employees'       AS src FROM fp_employees       WHERE email IS NOT NULL AND email != ''
    ) t
    GROUP BY email
    HAVING COUNT(DISTINCT src) > 1
    ORDER BY email
  `);

  if (rows.length === 0) {
    console.log('No email exists in more than one identity table. Clean.');
    process.exit(0);
  }

  console.log(`${APPLY ? 'APPLY MODE' : 'DRY RUN'} — ${rows.length} email(s) appear in more than one identity table\n`);

  for (const { email, sources } of rows) {
    const [u] = await pool.execute(
      `SELECT id, user_id, username, role, is_active, franchise_partner_id, password_hash FROM users WHERE LOWER(email) = ?`, [email]);
    const [f] = await pool.execute(
      `SELECT id, username, is_active, password_hash FROM franchise_partners WHERE LOWER(email) = ?`, [email]);
    const [e] = await pool.execute(
      `SELECT id, user_id, username, role, is_active, franchise_partner_id, password_hash FROM fp_employees WHERE LOWER(email) = ?`, [email]);

    const userRow = u[0], fpRow = f[0], empRow = e[0];
    const isFpPair = userRow && fpRow && ['franchise_partner', 'franchise'].includes(userRow.role);
    const sameHash = fpRow && userRow && fpRow.password_hash === userRow.password_hash;

    let kind, action = 'report only';
    if (isFpPair) {
      kind = sameHash ? 'PAIR (ok)' : 'PAIR — HASHES DIFFER';
      if (!sameHash) action = 'resync via password reset (not auto-fixed)';
    } else if (userRow && fpRow) {
      kind = 'ANOMALY';
      action = APPLY && userRow.is_active ? 'deactivate users row' : 'would deactivate users row';
      if (APPLY && userRow.is_active) {
        await pool.execute('UPDATE users SET is_active = 0 WHERE id = ?', [userRow.id]);
      }
    } else if (fpRow && empRow) {
      kind = 'FP_AS_EMP';
      action = APPLY && empRow.is_active ? 'deactivate fp_employees row' : 'would deactivate fp_employees row';
      if (APPLY && empRow.is_active) {
        await pool.execute('UPDATE fp_employees SET is_active = 0 WHERE id = ?', [empRow.id]);
      }
    } else if (userRow && empRow && !empRow.user_id) {
      kind = 'SHADOW';
      action = APPLY && empRow.is_active ? 'deactivate fp_employees row' : 'would deactivate fp_employees row';
      if (APPLY && empRow.is_active) {
        await pool.execute('UPDATE fp_employees SET is_active = 0 WHERE id = ?', [empRow.id]);
      }
    } else {
      kind = 'LINKED (normal)';
    }

    console.log(`${email}  [${sources}]`);
    if (userRow) console.log(`   users id=${userRow.id} user_id=${userRow.user_id} role=${userRow.role} active=${userRow.is_active} fp=${userRow.franchise_partner_id}`);
    if (fpRow)   console.log(`   franchise_partners id=${fpRow.id} active=${fpRow.is_active}`);
    if (empRow)  console.log(`   fp_employees id=${empRow.id} user_id=${empRow.user_id} role=${empRow.role} active=${empRow.is_active} fp=${empRow.franchise_partner_id}`);
    console.log(`   => ${kind} — ${action}\n`);
  }

  if (!APPLY) console.log('Dry run. Re-run with --apply to deactivate non-canonical rows.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
