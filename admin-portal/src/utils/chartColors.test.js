import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  MARKETING_PHASE_COLORS, MARKETING_DUE_COLORS, MARKETING_PRIORITY_COLORS,
  MARKETING_STATUS_COLORS, MARKETING_LEAD_STATUS_COLORS, MARKETING_OWNER_COLORS,
  MARKETING_CATEGORICAL
} from './chartColors.js';

const require = createRequire(import.meta.url);
const followUp = require('../../../backend/utils/marketingFollowUp.js');
const dashboard = require('../../../backend/utils/marketingDashboard.js');

const HEX = /^#[0-9A-F]{6}$/i;

// A colour map with a hole does not fail loudly -- the bar just renders in the fallback grey and
// nobody notices that "Payment Pending" lost its phase. Every option the API can return must have
// a colour, so these walk the real option lists rather than the maps' own keys.
const covers = (map, options, label) => {
  for (const option of options) {
    assert.ok(map[option], `${label} has no colour for "${option}"`);
    assert.match(map[option], HEX, `${label}["${option}"] is not a hex colour`);
  }
};

test('every lead status the tracker can hold has a colour', () => {
  covers(MARKETING_LEAD_STATUS_COLORS, followUp.LEAD_STATUSES, 'MARKETING_LEAD_STATUS_COLORS');
  assert.equal(Object.keys(MARKETING_LEAD_STATUS_COLORS).length, 18);
});

test('every due status has a colour', () => {
  covers(MARKETING_DUE_COLORS, followUp.DUE_STATUSES, 'MARKETING_DUE_COLORS');
});

test('every tracker status and priority has a colour', () => {
  covers(MARKETING_STATUS_COLORS, dashboard.TRACKER_STATUSES, 'MARKETING_STATUS_COLORS');
  covers(MARKETING_PRIORITY_COLORS, dashboard.PRIORITIES, 'MARKETING_PRIORITY_COLORS');
});

test('the phase map covers the six phases the stage charts group into', () => {
  covers(MARKETING_PHASE_COLORS, ['Visit', 'Estimate', 'Follow-Up', 'Closing', 'Won', 'Lost'],
    'MARKETING_PHASE_COLORS');
});

test('the categorical ramp is long enough for the longest ranked list', () => {
  // Lead Source is the longest at ten; a shorter ramp would repeat a colour within one chart.
  assert.ok(MARKETING_CATEGORICAL.length >= dashboard.LEAD_SOURCES.length,
    `ramp of ${MARKETING_CATEGORICAL.length} cannot colour ${dashboard.LEAD_SOURCES.length} sources`);
  assert.equal(new Set(MARKETING_CATEGORICAL).size, MARKETING_CATEGORICAL.length,
    'the ramp repeats a colour');
  for (const colour of MARKETING_CATEGORICAL) assert.match(colour, HEX);
});

test('both action owners have a colour', () => {
  covers(MARKETING_OWNER_COLORS, ['Coordinator', 'Executive'], 'MARKETING_OWNER_COLORS');
});

// The complaint that prompted this palette was that the charts were too bright against the cream
// cards. Saturation is what caused it, so it is what is pinned: pure web colours like #8B5CF6
// (84% sat) and #EF4444 (85%) are exactly what must not come back.
const saturation = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min);
};

test('no marketing colour is garish against the warm cream cards', () => {
  const all = [
    ...Object.entries(MARKETING_PHASE_COLORS),
    ...Object.entries(MARKETING_DUE_COLORS),
    ...Object.entries(MARKETING_PRIORITY_COLORS),
    ...Object.entries(MARKETING_STATUS_COLORS),
    ...Object.entries(MARKETING_LEAD_STATUS_COLORS),
    ...Object.entries(MARKETING_OWNER_COLORS),
    ...MARKETING_CATEGORICAL.map((c, i) => [`categorical[${i}]`, c])
  ];
  for (const [name, hex] of all) {
    const sat = saturation(hex);
    assert.ok(sat <= 0.45, `${name} ${hex} is ${Math.round(sat * 100)}% saturated — too vivid for the beige skin`);
  }
  assert.ok(all.length > 50, 'the whole palette is checked');
});
