import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { FingerJointSettings } from '../models/Project';
import type { ZoneSplit } from '../models/Zone';
import { buildBasePlate } from '../services/BasePlateBuilder';
import { fingerEdgePath } from '../services/FingerJoint';
import { extract } from '../services/WallExtractor';
import { wallLength } from '../services/PanelBuilder';

const fingerSettings: FingerJointSettings = {
  style: 'rectangular',
  fingerMm: 10,
  spaceMm: 10,
  widthMm: 3,
  edgeWidthMm: 2,
  playMm: 0,
  extraLengthMm: 0,
  surroundingSpaces: 0,
};

describe('buildBasePlate', () => {
  it('returns null when hasBottom is false', () => {
    const colors = new ColorHeightRegistry([{ id: 'outer', color: '#888', heightMm: 60 }]);
    const walls = extract({
      zoneTree: { kind: 'leaf', id: 'only' },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: 4,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });
    expect(buildBasePlate(walls, { x: 0, y: 0, width: 100, height: 50 }, 4, fingerSettings, false)).toBeNull();
  });

  it('covers the outer footprint with corner relief notches, and holes one per finger segment of every wall', () => {
    const colors = new ColorHeightRegistry([
      { id: 'outer', color: '#888', heightMm: 60 },
      { id: 'divider', color: '#f00', heightMm: 40 },
    ]);
    const innerRect = { x: 0, y: 0, width: 100, height: 50 };
    const outerThickness = 4;
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'divider',
      notches: [],
      first: { kind: 'leaf', id: 'left' },
      second: { kind: 'leaf', id: 'right' },
    };
    const walls = extract({
      zoneTree: root,
      innerRect,
      outerThickness,
      innerThickness: 2,
      outerColorId: 'outer',
      colors,
    });

    const plate = buildBasePlate(walls, innerRect, outerThickness, fingerSettings, true);
    expect(plate).not.toBeNull();
    expect(plate!.kind).toBe('basePlate');
    expect(plate!.materialThickness).toBe(outerThickness);

    // Bounding box matches the full outer footprint exactly -- corner
    // notches only carve the corners, they don't shrink the overall extent.
    const xs = plate!.outline.map((p) => p.x);
    const ys = plate!.outline.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-outerThickness, 6);
    expect(Math.max(...xs)).toBeCloseTo(innerRect.width + outerThickness, 6);
    expect(Math.min(...ys)).toBeCloseTo(-outerThickness, 6);
    expect(Math.max(...ys)).toBeCloseTo(innerRect.height + outerThickness, 6);

    // Rectangle with a square notch cut from each of its 4 corners: 12 vertices.
    expect(plate!.outline).toHaveLength(12);

    // One hole per 'finger' segment, summed across every wall (4 outer + 1 divider).
    const expectedHoleCount = walls.reduce(
      (sum, w) => sum + fingerEdgePath(wallLength(w), fingerSettings, true).filter((s) => s.kind === 'finger').length,
      0,
    );
    expect(plate!.holes).toHaveLength(expectedHoleCount);
    expect(plate!.holes.every((hole) => hole.length === 4)).toBe(true);
  });
});
