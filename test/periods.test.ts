import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveReportWindow } from '../src/report/periods.js';

test('resolveReportWindow resolves an explicit month', () => {
  const window = resolveReportWindow({ period: 'monthly', month: '2026-01' });
  assert.equal(window.label, '2026-01');
  assert.equal(window.start, '2026-01-01T00:00:00.000Z');
  assert.equal(window.end, '2026-01-31T23:59:59.999Z');
  assert.equal(window.days, 31);
});

test('resolveReportWindow defaults to last complete month when end is mid-month', () => {
  const window = resolveReportWindow({ period: 'monthly', endIso: '2026-02-09T12:00:00.000Z' });
  assert.equal(window.label, '2026-01');
  assert.equal(window.start, '2026-01-01T00:00:00.000Z');
  assert.equal(window.end, '2026-01-31T23:59:59.999Z');
  assert.equal(window.days, 31);
});

test('resolveReportWindow resolves an explicit quarter', () => {
  const window = resolveReportWindow({ period: 'quarterly', quarter: '2025-Q4' });
  assert.equal(window.label, '2025-Q4');
  assert.equal(window.start, '2025-10-01T00:00:00.000Z');
  assert.equal(window.end, '2025-12-31T23:59:59.999Z');
  assert.equal(window.days, 92);
});

test('resolveReportWindow defaults to last complete quarter when end is mid-quarter', () => {
  const window = resolveReportWindow({ period: 'quarterly', endIso: '2026-02-09T12:00:00.000Z' });
  assert.equal(window.label, '2025-Q4');
  assert.equal(window.start, '2025-10-01T00:00:00.000Z');
  assert.equal(window.end, '2025-12-31T23:59:59.999Z');
  assert.equal(window.days, 92);
});
