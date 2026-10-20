/**
 * Who is told what as a complaint moves through its workflow.
 *
 *   assigned -> the assignee          "this is yours now"
 *   progress -> the FP and its managers  the assignee set a status or saved a note
 *   closed   -> the assignee          the FP or its manager verified and closed it
 *   filed    -> the customer          "we have your complaint", with its reference
 *   status   -> the customer          every move, from Assigned through to Closed
 *
 * The customer hears about the *state* of their complaint and nothing else: the field notes are
 * what the FP and its manager verify, so they stay inside the staff portals.
 *
 * Each sends an email (services/emailService.sendEmail) and writes the in-portal row
 * (`portal_notifications`, the same table the scheduling feed uses), and **none of them ever
 * throws**. Every call site is a route that has already committed its write: a complaint whose
 * status was saved must not answer 500 because a mail server was slow, and nothing here may sit
 * inside a transaction -- a failed notification once rolled a customer's payment back, which is
 * why that rule is now written down (see AGENTS.md, payment_history.action).
 *
 * Text interpolated into the email HTML comes from the complaint row, which is stored
 * HTML-escaped (middleware/security.js escapes every request string and nothing is escaped on
 * output), so it is written in as it is read -- decoding it would un-escape user input into a
 * message. The in-portal message is the opposite: the portals render it as text, so it is decoded
 * first or a property id would read "GC&#x2F;1".
 */

const { pool } = require('../config/database');
const { sendEmail } = require('./emailService');
const { decodeEntities } = require('../utils/htmlEntities');
const { fetchPartnerName } = require('../utils/franchisePartnerName');
const { normalizeEmployeeRole } = require('../utils/marketingComplaints');
const { employeeName, coversZone, fetchEmployeeZones } = require('../utils/fpEmployeeDirectory');

const generateNotificationId = () =>
  `NTF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Where a recipient goes to act on the complaint: Marketing > Complaint Form in every portal, and
// /fp for the partner's own. The supervisor portal has that one screen and no other part of
// Marketing, so its path is the same shape as the rest.
const COMPLAINT_PATHS = {
  fp: '/fp/marketing/complaint-form',
  manager: '/manager/marketing/complaint-form',
  coordinator: '/coordinator/marketing/complaint-form',
  supervisor: '/supervisor/marketing/complaint-form',
  executive: '/executive/marketing/complaint-form'
};

const GOLD = '#B5812A';

const complaintPath = (role) => COMPLAINT_PATHS[normalizeEmployeeRole(role)] || COMPLAINT_PATHS.fp;

// A saved concern is a fixed option or, where the option is "Other", the typed text beside it --
// the same rule the portals' displayConcern follows.
const concernText = (complaint) => {
  const value = complaint.concern_with || '';
  if (decodeEntities(value).trim() === 'Other') return complaint.concern_with_other || 'Other';
  return value || '-';
};

/**
 * One email body for all three messages: a heading, a sentence, a definition list of the
 * complaint's own fields, and the note when there is one.
 */
const complaintEmailHtml = ({ heading, intro, complaint, rows = [], note, closing }) => {
  const detail = [
    ['Property ID', complaint.property_id],
    ['Zone', complaint.zone],
    ['Concern', concernText(complaint)],
    ['Contact Person', complaint.contact_person_name],
    ['Phone', complaint.phone_number],
    ...rows
  ]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding: 8px 12px; color: #6B7280; font-size: 13px; white-space: nowrap;">${label}</td>
        <td style="padding: 8px 12px; color: #111827; font-size: 13px; font-weight: 600;">${value}</td>
      </tr>`)
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <body style="margin: 0; padding: 0; background: #F6F3EC; font-family: Arial, Helvetica, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: ${GOLD}; height: 6px; border-radius: 10px 10px 0 0;"></div>
        <div style="background: #ffffff; border: 1px solid #E8DFC9; border-top: none; padding: 28px;">
          <p style="margin: 0 0 4px 0; color: ${GOLD}; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">XLAND INFRA</p>
          <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 20px;">${heading}</h2>
          <p style="margin: 0 0 20px 0; color: #4B5563; font-size: 14px; line-height: 1.6;">${intro}</p>

          <table style="width: 100%; border-collapse: collapse; background: #FFFAF0; border: 1px solid #F1E3C6; border-radius: 10px;">
            ${detail}
          </table>

          <p style="margin: 20px 0 6px 0; color: #6B7280; font-size: 13px;">Customer's comments</p>
          <div style="padding: 12px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; color: #111827; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${complaint.comments || '-'}</div>

          ${note ? `
          <p style="margin: 20px 0 6px 0; color: #6B7280; font-size: 13px;">Notes / comments from the field</p>
          <div style="padding: 12px; background: #FFFAF0; border: 1px solid #F1E3C6; border-radius: 8px; color: #111827; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">${note}</div>` : ''}

          <p style="margin: 24px 0 0 0; color: #4B5563; font-size: 13px; line-height: 1.6;">${closing}</p>
        </div>
        <div style="background: #FFFAF0; border: 1px solid #E8DFC9; border-top: none; border-radius: 0 0 10px 10px; padding: 16px; text-align: center;">
          <p style="margin: 0; color: #9CA3AF; font-size: 11px;">
            &copy; ${new Date().getFullYear()} XLAND INFRA Private Limited &middot; this is an automated notification
          </p>
        </div>
      </div>
    </body>
  </html>`;
};

/** The franchise partner's own mailbox and name. */
const partnerContact = async (franchisePartnerId) => {
  try {
    const [rows] = await pool.execute(
      'SELECT email FROM franchise_partners WHERE id = ? LIMIT 1',
      [franchisePartnerId]
    );
    return {
      email: rows[0]?.email || null,
      name: await fetchPartnerName(pool, franchisePartnerId)
    };
  } catch (e) {
    console.error('Complaint notification: partner lookup failed:', e.message);
    return { email: null, name: '' };
  }
};

/**
 * The partner's managers, the ones covering the complaint's zone first.
 *
 * A zone with no manager assigned to it falls back to every active manager, because the review
 * step is what closes the complaint: a complaint nobody is asked to verify would sit at Reviewed
 * for ever. The work-order recipients in emailService deliberately do the opposite (strictly
 * zone-centric) -- that is a notice, this is a hand-off.
 */
const partnerManagers = async (franchisePartnerId, zone) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, user_id, first_name, last_name, username, email, role
       FROM fp_employees
       WHERE franchise_partner_id = ? AND is_active = 1 AND email IS NOT NULL`,
      [franchisePartnerId]
    );
    const managers = rows.filter((row) => normalizeEmployeeRole(row.role) === 'manager');
    if (!managers.length) return [];
    const zoneMap = await fetchEmployeeZones(pool, franchisePartnerId);
    const inZone = managers.filter((manager) =>
      coversZone(zoneMap.get(manager.id) || [], zone, decodeEntities));
    return inZone.length ? inZone : managers;
  } catch (e) {
    console.error('Complaint notification: manager lookup failed:', e.message);
    return [];
  }
};

/** The fp_employees row a complaint is assigned to, or null. */
const assignedEmployee = async (complaint) => {
  if (!complaint.assigned_employee_id) return null;
  try {
    const [rows] = await pool.execute(
      `SELECT id, user_id, first_name, last_name, username, email, role
       FROM fp_employees WHERE id = ? LIMIT 1`,
      [complaint.assigned_employee_id]
    );
    return rows[0] || null;
  } catch (e) {
    console.error('Complaint notification: assignee lookup failed:', e.message);
    return null;
  }
};

const insertPortalNotification = async ({
  franchisePartnerId, userId, roleType, title, message, complaintId, actionUrl, priority = 'normal'
}) => {
  try {
    await pool.execute(
      `INSERT INTO portal_notifications
         (notification_id, user_id, franchise_partner_id, role_type, type, title, message,
          reference_type, reference_id, action_url, action_label, priority)
       VALUES (?, ?, ?, ?, 'complaint', ?, ?, 'complaint', ?, ?, 'View Complaint', ?)`,
      [
        generateNotificationId(), userId || null, franchisePartnerId || null, roleType || null,
        title, message, complaintId, actionUrl, priority
      ]
    );
  } catch (e) {
    // The table is brought up to date on boot (utils/portalNotificationsSchema.js); a row that
    // cannot be written must still not fail the request that caused it.
    console.error('Complaint notification: in-portal row failed:', e.message);
  }
};

// The plain-text one-liner the portals show. Decoded, because they render it as text.
const summaryLine = (complaint, lead) =>
  `${lead}\n${decodeEntities(complaint.property_id || '')} · ${decodeEntities(complaint.zone || '')} · ${decodeEntities(concernText(complaint))}`;

const send = async (to, subject, html) => {
  if (!to) return;
  try {
    await sendEmail({ to, subject, html });
  } catch (e) {
    console.error(`Complaint notification: email to ${to} failed:`, e.message);
  }
};

/**
 * A complaint has been handed to one employee: tell them, and put it in their portal.
 * @param {object} complaint the stored row, after the assignment
 */
const notifyComplaintAssigned = async (complaint) => {
  try {
    const employee = await assignedEmployee(complaint);
    if (!employee) return;
    const property = decodeEntities(complaint.property_id || '');
    const html = complaintEmailHtml({
      heading: 'A complaint has been assigned to you',
      intro: `${complaint.assigned_by || 'Your franchise partner'} has assigned this complaint to you. Please attend to it and keep its status up to date.`,
      complaint,
      rows: [['Assigned by', complaint.assigned_by], ['Status', complaint.status]],
      closing: `Open <strong>Marketing &rsaquo; Complaint Form</strong> in your portal to set the status to <strong>In Progress</strong> and save your notes against this complaint.`
    });
    await send(employee.email, `New complaint assigned to you - ${property}`, html);
    await insertPortalNotification({
      franchisePartnerId: complaint.franchise_partner_id,
      userId: employee.user_id,
      roleType: normalizeEmployeeRole(employee.role),
      title: 'New complaint assigned to you',
      message: summaryLine(complaint, 'Attend to this complaint and update its status.'),
      complaintId: complaint.id,
      actionUrl: complaintPath(employee.role),
      priority: 'high'
    });
  } catch (e) {
    console.error('Complaint assignment notification failed:', e.message);
  }
};

/**
 * The assignee reported progress -- a status, a note, or both. The FP and its managers are the
 * ones who verify and close, so they are who hears about it.
 */
const notifyComplaintProgress = async (complaint, { statusChanged = false, noteChanged = false } = {}) => {
  try {
    const partner = await partnerContact(complaint.franchise_partner_id);
    const managers = await partnerManagers(complaint.franchise_partner_id, complaint.zone);
    const who = complaint.assigned_employee_name || complaint.status_updated_by || 'The assigned employee';
    const what = statusChanged && noteChanged ? 'updated the status and saved notes on'
      : statusChanged ? 'updated the status of'
        : 'saved notes on';
    const property = decodeEntities(complaint.property_id || '');
    const html = complaintEmailHtml({
      heading: 'A complaint is ready for your review',
      intro: `${who} has ${what} this complaint. Please review and verify it, then close it officially.`,
      complaint,
      rows: [
        ['Status', complaint.status],
        ['Assigned To', complaint.assigned_employee_name],
        ['Updated By', complaint.note_updated_by || complaint.status_updated_by]
      ],
      note: complaint.complaint_note,
      closing: `Open <strong>Marketing &rsaquo; Complaint Form</strong>, verify the work, and set the status to <strong>Closed</strong>. Closing moves the complaint to <strong>Marketing &rsaquo; Archived</strong>.`
    });

    const subject = `Complaint ${property} ${statusChanged ? `is now ${decodeEntities(complaint.status || '')}` : 'has new notes'}`;
    await send(partner.email, subject, html);
    await insertPortalNotification({
      franchisePartnerId: complaint.franchise_partner_id,
      roleType: 'fp',
      title: 'A complaint is ready for your review',
      message: summaryLine(complaint, `${decodeEntities(who)} updated this complaint.`),
      complaintId: complaint.id,
      actionUrl: COMPLAINT_PATHS.fp
    });

    for (const manager of managers) {
      await send(manager.email, subject, html);
      await insertPortalNotification({
        franchisePartnerId: complaint.franchise_partner_id,
        userId: manager.user_id,
        roleType: 'manager',
        title: 'A complaint is ready for your review',
        message: summaryLine(complaint, `${decodeEntities(who)} updated this complaint.`),
        complaintId: complaint.id,
        actionUrl: COMPLAINT_PATHS.manager
      });
    }
  } catch (e) {
    console.error('Complaint progress notification failed:', e.message);
  }
};

// ============================================
// THE CUSTOMER
// ============================================
//
// What each status means to the person who filed the complaint, rather than to the staff working
// it. 'Open' is the acknowledgement; the rest are the updates.
const CUSTOMER_STATUS_COPY = {
  Open: {
    heading: 'We have received your complaint',
    intro: 'Thank you for telling us. Your complaint has been logged with our service team and we will update you as it progresses.'
  },
  Assigned: {
    heading: 'Your complaint has been assigned',
    intro: 'Your complaint has been assigned to a member of our team, who will attend to it shortly.'
  },
  'In Progress': {
    heading: 'Your complaint is being worked on',
    intro: 'Our team is attending to your complaint now. We will let you know as soon as the work is done.'
  },
  Reviewed: {
    heading: 'The work on your complaint has been checked',
    intro: 'The work on your complaint is finished and is being verified by our team before we close it.'
  },
  Closed: {
    heading: 'Your complaint has been resolved and closed',
    intro: 'Your complaint has been attended to, verified by our team and is now closed. If anything is still not right, reply to this email or file a new complaint from your portal.'
  }
};

// A complaint's reference, as the customer sees it on their own portal.
const complaintReference = (complaint) => `CMP-${complaint.id}`;

/**
 * Tell the customer where their complaint stands.
 *
 * Addressed by `customer_email`, which is stamped when the complaint is filed; a complaint with no
 * customer behind it (a partner filed it for a property whose resident could not be identified --
 * see utils/complaintCustomer.js) simply sends nothing.
 *
 * The in-portal row carries `user_id = customer_account_id` and `reference_type = 'complaint'`,
 * which is what scopes it to this one customer: a `portal_notifications` row carrying only a
 * franchise partner is visible to **every** customer of that partner.
 */
const notifyCustomerComplaintStatus = async (complaint, { status } = {}) => {
  try {
    if (!complaint?.customer_email) return;
    const state = decodeEntities(status || complaint.status || 'Open').trim();
    const copy = CUSTOMER_STATUS_COPY[state];
    if (!copy) return;

    const reference = complaintReference(complaint);
    const html = complaintEmailHtml({
      heading: copy.heading,
      intro: copy.intro,
      complaint,
      rows: [['Reference', reference], ['Status', state]],
      closing: 'You can follow your complaint any time from <strong>Contact / Help</strong> in your XLAND INFRA portal.'
    });
    await send(complaint.customer_email, `${copy.heading} - ${reference}`, html);
    await insertPortalNotification({
      franchisePartnerId: complaint.franchise_partner_id,
      userId: complaint.customer_account_id,
      roleType: 'customer',
      title: copy.heading,
      message: summaryLine(complaint, `${reference} · ${state}`),
      complaintId: complaint.id,
      // The bell navigates straight to this, and the customer portal's pages live under /dashboard
      // (frontend/src/App.jsx) -- '/contact' alone is the public marketing site's own route.
      actionUrl: '/dashboard/contact',
      priority: state === 'Closed' ? 'high' : 'normal'
    });
  } catch (e) {
    console.error('Customer complaint notification failed:', e.message);
  }
};

/** Closed and archived: the employee who worked it is told it is finished. */
const notifyComplaintClosed = async (complaint) => {
  try {
    const employee = await assignedEmployee(complaint);
    if (!employee) return;
    const property = decodeEntities(complaint.property_id || '');
    const html = complaintEmailHtml({
      heading: 'The complaint you worked on has been closed',
      intro: `${complaint.closed_by || 'Your franchise partner'} has reviewed and officially closed this complaint. No further action is needed.`,
      complaint,
      rows: [['Status', complaint.status], ['Closed By', complaint.closed_by]],
      note: complaint.complaint_note,
      closing: 'The complaint has moved to <strong>Marketing &rsaquo; Archived</strong>, where it can still be read.'
    });
    await send(employee.email, `Complaint closed - ${property}`, html);
    await insertPortalNotification({
      franchisePartnerId: complaint.franchise_partner_id,
      userId: employee.user_id,
      roleType: normalizeEmployeeRole(employee.role),
      title: 'A complaint you worked on was closed',
      message: summaryLine(complaint, 'Reviewed, closed and moved to Archived.'),
      complaintId: complaint.id,
      actionUrl: complaintPath(employee.role)
    });
  } catch (e) {
    console.error('Complaint close notification failed:', e.message);
  }
};

module.exports = {
  COMPLAINT_PATHS,
  complaintPath,
  complaintReference,
  CUSTOMER_STATUS_COPY,
  notifyComplaintAssigned,
  notifyComplaintProgress,
  notifyComplaintClosed,
  notifyCustomerComplaintStatus
};
