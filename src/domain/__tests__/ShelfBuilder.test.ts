import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { ProjectConfig } from '../models/Project';
import { buildShelf } from '../services/ShelfBuilder';
import { extract } from '../services/WallExtractor';

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    outerThickness: 4,
    innerThickness: 2,
    outerColorId: 'outer',
    baseWallHeightMm: 60,
    dimX: { value: 100, mode: 'inner' },
    dimY: { value: 50, mode: 'inner' },
    hasBottom: true,
    shelf: null,
    advanced: {
      laserBedX: 500,
      laserBedY: 300,
      burnMm: 0.1,
      innerCornerStyle: 'corner',
      partSpacingMm: 2,
      fingerJoint: {
        style: 'rectangular',
        fingerMm: 10,
        spaceMm: 10,
        widthMm: 3,
        edgeWidthMm: 2,
        playMm: 0,
        extraLengthMm: 0,
        surroundingSpaces: 0,
      },
    },
    ...overrides,
  };
}

const innerRect = { x: 0, y: 0, width: 100, height: 50 };
const colors = new ColorHeightRegistry([{ id: 'outer', color: '#888', heightMm: 60 }]);
const outerWalls = extract({
  grid: { lines: [] },
  innerRect,
  outerThickness: 4,
  innerThickness: 2,
  outerColorId: 'outer',
  colors,
});

describe('buildShelf', () => {
  it('returns null when no shelf is configured', () => {
    expect(buildShelf(outerWalls, innerRect, baseConfig({ shelf: null }))).toBeNull();
  });

  it('fixed mode: places the shelf at heightMm above the cavity floor (base plate top, not z=0) and generates no cleats', () => {
    const config = baseConfig({ shelf: { heightMm: 25, mode: 'fixed' } }); // hasBottom: true, outerThickness: 4
    const result = buildShelf(outerWalls, innerRect, config);
    expect(result).not.toBeNull();
    expect(result!.shelf.kind).toBe('shelf');
    expect(result!.shelf.placement3d?.origin.z).toBe(4 + 25);
    expect(result!.cleats).toHaveLength(0);
  });

  it('removable mode: generates one cleat per outer wall, at heightMm above the cavity floor', () => {
    const config = baseConfig({ shelf: { heightMm: 18, mode: 'removable' } });
    const result = buildShelf(outerWalls, innerRect, config);
    expect(result!.cleats).toHaveLength(outerWalls.length);
    expect(result!.cleats.every((c) => c.kind === 'shelfCleat')).toBe(true);
    expect(result!.cleats.every((c) => c.placement3d?.origin.z === 4 + 18)).toBe(true);
  });

  it('does not add the base plate offset when there is no base plate (hasBottom: false)', () => {
    const config = baseConfig({ hasBottom: false, shelf: { heightMm: 25, mode: 'fixed' } });
    const result = buildShelf(outerWalls, innerRect, config);
    expect(result!.shelf.placement3d?.origin.z).toBe(25);
  });
});
