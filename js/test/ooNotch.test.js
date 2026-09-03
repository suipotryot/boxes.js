// Notch (encoche pour doigt) — see js/geometry/oo/Notch.js's own header
// comment for the design. Ported from js/test/gripNotch.test.js's pure
// shape/format tests; the integration tests against buildWallPanel etc.
// stay on the old suite until the equivalence-test step (Edge/Panel/Box
// don't exist yet).
import { test, assert, assertClose, run } from './testHarness.js';
import { Notch, DEFAULT_NOTCH } from '../geometry/oo/Notch.js';

// --- toEdgeFragment: pure shape math ---

test('toEdgeFragment: radius 0 gives exactly 2 flat points', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 10, offsetMm: 20, radiusMm: 0 });
  const frag = notch.toEdgeFragment(50);
  assert(frag.points.length === 2);
  assertClose(frag.points[0].y, 40, 1e-9);
  assertClose(frag.points[1].y, 40, 1e-9);
  assertClose(frag.points[0].u, 20, 1e-9);
  assertClose(frag.points[1].u, 50, 1e-9);
});

test('toEdgeFragment: intermediate radius keeps a flat floor stretch and matches the analytic circle', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 20, offsetMm: 20, radiusMm: 8 });
  const localHeight = 50;
  const floor = localHeight - notch.depthMm; // 30
  const frag = notch.toEdgeFragment(localHeight);
  const flatFloorPoints = frag.points.filter((p) => Math.abs(p.y - floor) < 1e-6);
  const flatUs = new Set(flatFloorPoints.map((p) => Math.round(p.u * 1000)));
  assert(flatUs.size >= 2, 'expected at least 2 distinct u positions at the flat floor');

  const leftCenter = { u: notch.offsetMm + notch.radiusMm, y: floor + notch.radiusMm };
  const rightCenter = { u: notch.offsetMm + notch.widthMm - notch.radiusMm, y: floor + notch.radiusMm };
  for (const p of frag.points) {
    const dL = Math.hypot(p.u - leftCenter.u, p.y - leftCenter.y);
    const dR = Math.hypot(p.u - rightCenter.u, p.y - rightCenter.y);
    const onLeft = Math.abs(dL - notch.radiusMm) < 1e-6;
    const onRight = Math.abs(dR - notch.radiusMm) < 1e-6;
    const onFlatFloor = Math.abs(p.y - floor) < 1e-6;
    assert(onLeft || onRight || onFlatFloor, `point (${p.u},${p.y}) is not on either fillet arc nor the flat floor`);
  }
});

test('toEdgeFragment: radius pushed to its max with depth=width/2 degenerates to a full semicircle (no flat floor, no residual vertical wall)', () => {
  const notch = new Notch({ widthMm: 30, depthMm: 15, offsetMm: 20, radiusMm: 15 });
  const localHeight = 50;
  const frag = notch.toEdgeFragment(localHeight);
  const floor = localHeight - notch.depthMm;
  const distinctFloorUs = new Set(frag.points.filter((p) => Math.abs(p.y - floor) < 1e-6).map((p) => Math.round(p.u * 1000)));
  assert(distinctFloorUs.size === 1, 'a full semicircle should touch the floor at exactly one point (the center), not a flat stretch');
  assertClose(frag.points[0].y, localHeight, 1e-6);
  assertClose(frag.points[frag.points.length - 1].y, localHeight, 1e-6);
  const center = { u: notch.offsetMm + notch.widthMm / 2, y: floor + notch.radiusMm };
  for (const p of frag.points) assertClose(Math.hypot(p.u - center.u, p.y - center.y), notch.radiusMm, 1e-6);
});

test('toEdgeFragment: a radius beyond its own geometric max is clamped defensively, u stays monotonic (no crossing arcs)', () => {
  const notch = new Notch({ widthMm: 20, depthMm: 5, offsetMm: 10, radiusMm: 1000 });
  const frag = notch.toEdgeFragment(50);
  for (let i = 1; i < frag.points.length; i++) {
    assert(frag.points[i].u >= frag.points[i - 1].u - 1e-6, 'u should never decrease along the notch outline — a crossing would double back on itself');
  }
  const us = frag.points.map((p) => p.u);
  assert(Math.min(...us) >= notch.offsetMm - 1e-6 && Math.max(...us) <= notch.offsetMm + notch.widthMm + 1e-6);
});

// --- Notch.listFor: normalizing what's actually stored ---

test('Notch.listFor: a real array becomes a list of Notch instances, same order/values', () => {
  const stored = [{ widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 }];
  const list = Notch.listFor({ id1: stored }, 'id1');
  assert(list.length === 1 && list[0] instanceof Notch);
  assertClose(list[0].widthMm, 10, 1e-9);
});

test('Notch.listFor: a legacy single-object shape with enabled:true becomes a 1-element list', () => {
  const legacy = { enabled: true, widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 };
  const result = Notch.listFor({ id1: legacy }, 'id1');
  assert(Array.isArray(result) && result.length === 1 && result[0] instanceof Notch);
  assertClose(result[0].widthMm, 10, 1e-9);
});

test('Notch.listFor: a legacy object with enabled:false, or a missing entry, becomes an empty list', () => {
  assert(Notch.listFor({ id1: { enabled: false, widthMm: 10, depthMm: 5, offsetMm: 0, radiusMm: 0 } }, 'id1').length === 0);
  assert(Notch.listFor({}, 'id1').length === 0);
  assert(Notch.listFor(undefined, 'id1').length === 0);
});

// --- toTextLine / fromTextLine: the single copy/paste-able text field ---

test('toTextLine/fromTextLine round-trip a well-formed notch', () => {
  const notch = new Notch({ widthMm: 20.5, depthMm: 8, radiusMm: 0, offsetMm: 10 });
  const line = notch.toTextLine();
  assert(line === '20.5, 8, 0, 10', `unexpected format: "${line}"`);
  const parsed = Notch.fromTextLine(line);
  assert(parsed instanceof Notch);
  assertClose(parsed.widthMm, notch.widthMm, 1e-9);
  assertClose(parsed.depthMm, notch.depthMm, 1e-9);
  assertClose(parsed.radiusMm, notch.radiusMm, 1e-9);
  assertClose(parsed.offsetMm, notch.offsetMm, 1e-9);
});

test('Notch.fromTextLine rejects malformed input rather than guessing', () => {
  assert(Notch.fromTextLine('20, 8, 0') === null, 'only 3 values should be rejected');
  assert(Notch.fromTextLine('20, 8, 0, 10, 5') === null, '5 values should be rejected');
  assert(Notch.fromTextLine('20, huit, 0, 10') === null, 'a non-numeric token should be rejected');
  assert(Notch.fromTextLine('20,5, 8, 0, 10') === null, 'a French decimal comma ("20,5" meant as one number) must NOT silently become width=20 — the whole line has 5 tokens and should be rejected, not misparsed');
  assert(Notch.fromTextLine('20, , 0, 10') === null, 'an empty token between commas should be rejected, not silently become 0');
});

test('Notch.fromTextLine accepts a period as the decimal separator and trims whitespace', () => {
  const parsed = Notch.fromTextLine(' 20.5 ,8,0.0, 10 ');
  assert(parsed !== null);
  assertClose(parsed.widthMm, 20.5, 1e-9);
  assertClose(parsed.depthMm, 8, 1e-9);
});

test('DEFAULT_NOTCH is a well-formed, valid-shaped starting point', () => {
  const notch = new Notch(DEFAULT_NOTCH);
  assert(notch.widthMm > 0 && notch.depthMm > 0 && notch.radiusMm === 0);
});

run();
