import { describe, expect, it } from 'vitest';

import type { Project } from '../models/Project';
import type { ZoneSplit } from '../models/Zone';
import { canSetColorHeight, canSetShelfHeight } from '../services/HeightConstraints';

function project(overrides: Partial<Project> = {}): Project {
  const tree: ZoneSplit = {
    kind: 'split',
    id: 'root',
    axis: 'x',
    firstSize: 40,
    dividerColorId: 'divider',
    notches: [],
    first: { kind: 'leaf', id: 'left' },
    second: { kind: 'leaf', id: 'right' },
  };
  return {
    id: 'p1',
    name: 'Test',
    zoneTree: tree,
    colors: [
      { id: 'outer', color: '#888', heightMm: 60 },
      { id: 'divider', color: '#f00', heightMm: 30 },
    ],
    config: {
      outerThickness: 4,
      innerThickness: 2,
      outerColorId: 'outer',
      baseWallHeightMm: 30,
      dimX: { value: 100, mode: 'inner' },
      dimY: { value: 50, mode: 'inner' },
      hasBottom: true,
      shelf: { heightMm: 35, mode: 'fixed' },
      advanced: {
        laserBedX: 300,
        laserBedY: 200,
        burnMm: 0.1,
        innerCornerStyle: 'corner',
        partSpacingMm: 2,
        fingerJoint: {
          style: 'rectangular',
          fingerMm: 10,
          spaceMm: 10,
          widthMm: 2,
          edgeWidthMm: 4,
          playMm: 0,
          extraLengthMm: 0,
          surroundingSpaces: 0,
        },
      },
    },
    ...overrides,
  };
}

describe('canSetColorHeight', () => {
  it('allows any height when no shelf is active', () => {
    const p = project({ config: { ...project().config, shelf: null } });
    expect(canSetColorHeight(p, 'divider', 1000)).toBe(true);
  });

  it('rejects a divider height above the active shelf height', () => {
    const p = project(); // shelf at 35
    expect(canSetColorHeight(p, 'divider', 36)).toBe(false);
  });

  it('allows a divider height at or below the active shelf height', () => {
    const p = project();
    expect(canSetColorHeight(p, 'divider', 35)).toBe(true);
    expect(canSetColorHeight(p, 'divider', 20)).toBe(true);
  });

  it('never constrains the outer wall color, regardless of shelf height', () => {
    const p = project();
    expect(canSetColorHeight(p, 'outer', 1000)).toBe(true);
  });

  it('allows any height for a color not currently used by any divider', () => {
    const p = project();
    expect(canSetColorHeight(p, 'unused-color', 1000)).toBe(true);
  });
});

describe('canSetShelfHeight', () => {
  it('rejects a shelf height below the tallest existing divider', () => {
    const p = project(); // divider height 30
    expect(canSetShelfHeight(p, 29)).toBe(false);
  });

  it('allows a shelf height at or above the tallest existing divider', () => {
    const p = project();
    expect(canSetShelfHeight(p, 30)).toBe(true);
    expect(canSetShelfHeight(p, 100)).toBe(true);
  });

  it('allows any height when there are no dividers yet', () => {
    const p = project({ zoneTree: { kind: 'leaf', id: 'only' } });
    expect(canSetShelfHeight(p, 0)).toBe(true);
  });
});
