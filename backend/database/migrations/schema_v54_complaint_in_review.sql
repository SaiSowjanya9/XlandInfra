-- Migration: schema_v54 - one In Review step in place of In Progress and Reviewed
--
-- The complaint workflow was
--
--   Open -> Assigned -> In Progress -> Reviewed -> Closed
--
-- where the assignee set 'In Progress' from a dropdown on their own row and the FP set
-- 'Reviewed' before closing. Two things were wrong with that. The assignee had a status to
-- pick, so they could mark their own work reviewed -- and the point of the step is that
-- somebody else looks. And the two statuses described one state between them: the employee is
-- done and the FP has to check. It is now
--
--   Open -> Assigned -> In Review -> Closed
--
-- with no status control for the employee at all: saving their note is the report, and the
-- server moves the row to In Review in the same statement (PUT …/complaints/:id/note).
--
-- Both retired statuses therefore become 'In Review': a row at 'In Progress' is waiting for the
-- FP whether or not the FP had got round to marking it 'Reviewed', and that is what In Review
-- says. Nothing is lost -- who moved it and when are in status_updated_by / status_updated_at,
-- and the employee's own report is in complaint_note.
--
-- `normalizeComplaintStatus` in backend/utils/marketingComplaints.js maps the same two values on
-- the way out, so a deployment that has not applied this file still reads correctly; this makes
-- the stored rows agree with the code.
--
-- IMPORTANT: written for MySQL 8. Safe to re-run: after the first pass no row matches.

UPDATE fp_marketing_complaints
   SET status = 'In Review'
 WHERE status IN ('In Progress', 'Reviewed');
