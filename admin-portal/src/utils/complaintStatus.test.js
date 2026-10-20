/**
 * The browser's copy of the complaint workflow has to agree with the server's, or a portal offers
 * a status whose save answers 403 -- or, worse, hides one the caller was entitled to set.
 *
 * Run: node --test admin-portal/src/utils/complaintStatus.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  COMPLAINT_STATUSES, complaintStatusesFor, canNoteOnComplaint, complaintStatusStyle
} from './complaintStatus.js';

const require = createRequire(import.meta.url);
// Requiring this only creates a connection pool; nothing below queries it.
const server = require('../../../backend/utils/marketingComplaints.js');

test('the browser and the server describe the same lifecycle', () => {
  assert.deepEqual(COMPLAINT_STATUSES, server.COMPLAINT_STATUSES);
});

test('every caller is offered exactly what the server would accept', () => {
  for (const canClose of [false, true]) {
    for (const isAssignee of [false, true]) {
      const options = complaintStatusesFor({ canClose, isAssignee });
      assert.deepEqual(options, server.complaintStatusesFor({ canClose, isAssignee }),
        `canClose=${canClose} isAssignee=${isAssignee}`);
      // And what is offered really does save: the server validates each one the same way.
      for (const status of options) {
        assert.equal(server.resolveComplaintStatus({ status }, { canClose, isAssignee }).error, null,
          `${status} for canClose=${canClose} isAssignee=${isAssignee}`);
      }
      // Nothing outside the list would be accepted either, so hiding it is honest.
      for (const status of COMPLAINT_STATUSES.filter((s) => !options.includes(s))) {
        assert.ok(server.resolveComplaintStatus({ status }, { canClose, isAssignee }).error,
          `${status} must be refused for canClose=${canClose} isAssignee=${isAssignee}`);
      }
    }
  }
});

test('the assignee may write the note, wherever they are read-only otherwise', () => {
  assert.equal(canNoteOnComplaint({ assigned_to_me: true }, { canEdit: false }), true);
  assert.equal(canNoteOnComplaint({ assigned_to_me: false }, { canEdit: true }), true);
  assert.equal(canNoteOnComplaint({ assigned_to_me: false }, { canEdit: false }), false);
  assert.equal(canNoteOnComplaint(null, {}), false);
});

test('every status has a tint, and an unknown one still reads', () => {
  for (const status of COMPLAINT_STATUSES) {
    assert.match(complaintStatusStyle(status), /bg-/, status);
  }
  // A row written before schema_v51 has no status; the list shows it as Open rather than blank.
  assert.equal(complaintStatusStyle(undefined), complaintStatusStyle('Open'));
});
