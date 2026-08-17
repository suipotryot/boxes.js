import { describe, expect, it } from 'vitest';

import type { FingerJointSettings } from '../models/Project';
import { fingerEdgePath, fingerHoleRow } from '../services/FingerJoint';

const settings: FingerJointSettings = {
  style: 'rectangular',
  fingerMm: 10,
  spaceMm: 10,
  widthMm: 3,
  edgeWidthMm: 2,
  playMm: 0,
  extraLengthMm: 0,
  surroundingSpaces: 0,
};

function totalLength(segments: { length: number }[]): number {
  return segments.reduce((sum, s) => sum + s.length, 0);
}

describe('fingerEdgePath', () => {
  it('covers the full edge length exactly, regardless of how evenly it divides', () => {
    for (const length of [40, 47.3, 100, 123.456]) {
      const segments = fingerEdgePath(length, settings, true);
      expect(totalLength(segments)).toBeCloseTo(length, 6);
    }
  });

  it('starts and ends with a flush margin when edgeWidthMm > 0', () => {
    const segments = fingerEdgePath(100, settings, true);
    expect(segments[0]!.kind).toBe('flush');
    expect(segments[0]!.length).toBeCloseTo(settings.edgeWidthMm, 6);
    expect(segments.at(-1)!.kind).toBe('flush');
    expect(segments.at(-1)!.length).toBeCloseTo(settings.edgeWidthMm, 6);
  });

  it('has no flush margin when edgeWidthMm and surroundingSpaces are both 0', () => {
    const bare: FingerJointSettings = { ...settings, edgeWidthMm: 0, surroundingSpaces: 0 };
    const segments = fingerEdgePath(100, bare, true);
    expect(segments.every((s) => s.kind !== 'flush')).toBe(true);
  });

  it('alternates finger/space strictly between the two flush margins', () => {
    const segments = fingerEdgePath(100, settings, true);
    const inner = segments.slice(1, -1);
    expect(inner[0]!.kind).toBe('finger');
    for (let i = 1; i < inner.length; i++) {
      expect(inner[i]!.kind).not.toBe(inner[i - 1]!.kind);
    }
  });

  it('honors startWithFinger for the first non-flush segment', () => {
    const withFinger = fingerEdgePath(100, settings, true);
    const withSpace = fingerEdgePath(100, settings, false);
    const firstNonFlush = (segs: typeof withFinger) => segs.find((s) => s.kind !== 'flush')!;
    expect(firstNonFlush(withFinger).kind).toBe('finger');
    expect(firstNonFlush(withSpace).kind).toBe('space');
  });

  it('produces complementary patterns for mating edges: same boundaries, opposite kind on every non-flush segment', () => {
    const a = fingerEdgePath(100, settings, true);
    const b = fingerEdgePath(100, settings, false);
    expect(a).toHaveLength(b.length);
    for (let i = 0; i < a.length; i++) {
      expect(a[i]!.start).toBeCloseTo(b[i]!.start, 6);
      expect(a[i]!.length).toBeCloseTo(b[i]!.length, 6);
      if (a[i]!.kind === 'flush') {
        expect(b[i]!.kind).toBe('flush');
      } else {
        expect(a[i]!.kind).not.toBe(b[i]!.kind);
      }
    }
  });

  it('falls back to a single finger when the edge is too short for even one pair', () => {
    const segments = fingerEdgePath(1, { ...settings, edgeWidthMm: 0, surroundingSpaces: 0 }, true);
    expect(totalLength(segments)).toBeCloseTo(1, 6);
    expect(segments.some((s) => s.kind === 'finger')).toBe(true);
  });
});

describe('fingerHoleRow', () => {
  it('emits one hole per finger AND flush (margin) segment, sized and positioned to match', () => {
    // PanelBuilder.buildEndEdge protrudes the entering wall's material
    // fully through the carrying wall at BOTH 'finger' and 'flush' bands
    // (only a genuine 'space' band retreats short of it) -- so both need a
    // matching hole here, or the entering wall's margin material collides
    // with the carrying wall's otherwise-solid, uncut material there.
    const holes = fingerHoleRow(0, 100, settings, 4);
    const expectedSegments = fingerEdgePath(100, settings, true).filter((s) => s.kind === 'finger' || s.kind === 'flush');
    expect(holes).toHaveLength(expectedSegments.length);
    holes.forEach((hole, i) => {
      expect(hole.x).toBeCloseTo(expectedSegments[i]!.start, 6);
      expect(hole.width).toBeCloseTo(expectedSegments[i]!.length, 6);
      expect(hole.height).toBe(4);
    });
  });

  it('does NOT emit a hole for a space segment -- the entering wall retreats short of the carrying wall there', () => {
    const holes = fingerHoleRow(0, 100, settings, 4);
    const spaceSegments = fingerEdgePath(100, settings, true).filter((s) => s.kind === 'space');
    for (const space of spaceSegments) {
      expect(holes.some((h) => Math.abs(h.x - space.start) < 1e-6)).toBe(false);
    }
  });

  it('offsets all holes by startOffset', () => {
    const atZero = fingerHoleRow(0, 100, settings, 4);
    const offset = fingerHoleRow(25, 100, settings, 4);
    expect(offset.map((h) => h.x)).toEqual(atZero.map((h) => h.x + 25));
  });
});
