/**
 * Shared helpers for the fp_marketing_complaints table.
 *
 * Marketing > Complaint Form logs a customer complaint against a property -- the same fields the
 * "XLAND Customer complaints form" collects. Customers file the same record from their portal's
 * Contact page, which is why this lives in a util instead of franchisePartner.js: the FP routes
 * write every field, the customer route derives all but concern/comments from the login profile.
 * Deleting a row only archives it: it leaves the form's list and lands in Marketing > Archived
 * under its own tab, restorable from there.
 */

const { pool } = require('../config/database');
const { decodeEntities } = require('./htmlEntities');

const COMPLAINT_TABLE = 'fp_marketing_complaints';

const ensureMarketingComplaintsTable = async () => {
  try {
    const [tables] = await pool.execute(
      `SELECT COUNT(*) AS n FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [COMPLAINT_TABLE]
    );
    if (tables[0].n === 0) {
      // Same statement as schema_v47_marketing_complaints.sql, so a deployment that has not
      // applied the file still works.
      await pool.execute(
        `CREATE TABLE ${COMPLAINT_TABLE} (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          franchise_partner_id INT NOT NULL,
          property_id VARCHAR(255) NOT NULL,
          zone VARCHAR(255) NOT NULL,
          responsible_person VARCHAR(255) NOT NULL,
          concern_with VARCHAR(100) NOT NULL,
          concern_with_other VARCHAR(255) NULL,
          contact_person_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50) NOT NULL,
          comments TEXT NOT NULL,
          archived_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_fp_marketing_complaints_fp (franchise_partner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
    }
  } catch (e) { /* table exists or cannot be created; the query below will say which */ }
};

// The concern options the complaint form offers; 'Other' carries its free text in
// concern_with_other. Keep in step with CONCERN_OPTIONS in FPMarketingComplaintForm.jsx and
// frontend/src/pages/Contact.jsx.
const CONCERN_OPTIONS = ['Service Delay', 'Poor Quality Work', 'Incomplete Work', 'Safety Issue', 'Vendor Issue', 'Maintenance Issue', 'Pricing/Payments', 'Other'];

const COMPLAINT_TEXT_FIELDS = [
  ['property_id', 'Property ID', 255],
  ['zone', 'Zone', 255],
  ['responsible_person', 'Responsible person', 255],
  ['contact_person_name', 'Contact Person Name', 255],
  ['phone_number', 'Phone number', 50],
  ['comments', 'Comments', 4000]
];

const COMPLAINT_SELECT = `id, property_id, zone, responsible_person,
  concern_with, concern_with_other, contact_person_name, phone_number, comments,
  archived_at, created_at, updated_at`;

// The customer form only asks for the concern and comments; the concern validation is shared by
// both parsers. Request text arrives HTML-escaped (middleware/security.js); it is stored exactly
// as it came so the escapes are not doubled, but validation judges the decoded text --
// 'Pricing&#x2F;Payments' has to match 'Pricing/Payments'.
const parseConcern = (body, complaint, errors) => {
  const concernRaw = (body.concern_with || '').toString().trim().slice(0, 100);
  const concern = decodeEntities(concernRaw).trim();
  if (!concern) {
    errors.push('Concern With is required');
  } else if (!CONCERN_OPTIONS.includes(concern)) {
    errors.push(`Concern With must be one of: ${CONCERN_OPTIONS.join(', ')}`);
  } else {
    complaint.concern_with = concernRaw;
  }
  const otherRaw = (body.concern_with_other || '').toString().trim().slice(0, 255);
  complaint.concern_with_other = concern === 'Other' ? otherRaw : null;
  if (concern === 'Other' && !decodeEntities(otherRaw).trim()) {
    errors.push('Please specify the concern when Other is selected');
  }
};

// Every field is required, exactly as the complaint form marks them.
const parseComplaintBody = (body) => {
  const errors = [];
  const complaint = {};
  for (const [field, label, max] of COMPLAINT_TEXT_FIELDS) {
    const raw = (body[field] || '').toString().trim().slice(0, max);
    complaint[field] = raw;
    if (!decodeEntities(raw).trim()) errors.push(`${label} is required`);
  }
  if (complaint.phone_number && !/^\d{10}$/.test(complaint.phone_number)) {
    errors.push('Phone number must be 10 digits');
  }
  parseConcern(body, complaint, errors);
  return { errors, complaint };
};

// The customer portal sends only the concern and comments; the rest is filled from the profile.
const parseCustomerComplaintBody = (body) => {
  const errors = [];
  const complaint = {};
  const comments = (body.comments || '').toString().trim().slice(0, 4000);
  complaint.comments = comments;
  if (!decodeEntities(comments).trim()) errors.push('Comments is required');
  parseConcern(body, complaint, errors);
  return { errors, complaint };
};

module.exports = {
  COMPLAINT_TABLE,
  COMPLAINT_SELECT,
  CONCERN_OPTIONS,
  ensureMarketingComplaintsTable,
  parseComplaintBody,
  parseCustomerComplaintBody
};
