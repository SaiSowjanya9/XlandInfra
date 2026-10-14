import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDismiss } from './dismiss.js';

// The shapes the real DOM presents, with just the two members the decision reads.
const node = (children = []) => {
  const self = {
    children,
    isConnected: true,
    contains: (target) => target === self || children.some((child) => child.contains?.(target) || child === target)
  };
  return self;
};

test('a click inside the panel keeps it open', () => {
  const option = node();
  const panel = node([option]);
  panel.parentElement = node([panel]);
  assert.equal(shouldDismiss(panel, option), false);
  assert.equal(shouldDismiss(panel, panel), false);
});

test('a click on the trigger is not outside', () => {
  // This is the one that matters: the trigger is a sibling of the panel inside the positioned
  // wrapper. Closing on its mousedown would let its own click reopen the panel, so it would
  // never shut.
  const trigger = node();
  const panel = node();
  const wrapper = node([trigger, panel]);
  panel.parentElement = wrapper;
  assert.equal(shouldDismiss(panel, trigger), false);
});

test('a click anywhere else closes it', () => {
  const panel = node();
  panel.parentElement = node([panel]);
  const elsewhere = node();
  assert.equal(shouldDismiss(panel, elsewhere), true);
});

test('nothing to judge is never a dismissal', () => {
  assert.equal(shouldDismiss(null, node()), false, 'the panel is not rendered');
  assert.equal(shouldDismiss(node(), null), false, 'the event carried no target');
});

test('a panel with no parent falls back to itself', () => {
  const inside = node();
  const panel = node([inside]);
  panel.parentElement = null;
  assert.equal(shouldDismiss(panel, inside), false);
  assert.equal(shouldDismiss(panel, node()), true);
});

test('a target already removed from the page is ignored', () => {
  // An option that unmounts on click -- the row is gone by the time mousedown is handled, and
  // `contains` would answer false, which would read as a click on the page behind it.
  const panel = node();
  panel.parentElement = node([panel]);
  const detached = { ...node(), isConnected: false };
  assert.equal(shouldDismiss(panel, detached), false);
});
