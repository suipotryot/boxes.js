import { describe, expect, it } from 'vitest';

import type { Project, ProjectConfig } from '../models/Project';
import type { ZoneSplit } from '../models/Zone';
import { generatePanels, resolveInnerRect } from '../services/ProjectGenerator';

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

describe('resolveInnerRect', () => {
  it('uses the dimension value directly in inner mode', () => {
    const config = baseConfig({ dimX: { value: 100, mode: 'inner' }, dimY: { value: 50, mode: 'inner' } });
    const rect = resolveInnerRect(config);
    expect(rect).toEqual({ x: 4, y: 4, width: 100, height: 50 });
  });

  it('subtracts 2x outerThickness in outer mode', () => {
    const config = baseConfig({ dimX: { value: 108, mode: 'outer' }, dimY: { value: 58, mode: 'outer' } });
    const rect = resolveInnerRect(config);
    expect(rect).toEqual({ x: 4, y: 4, width: 100, height: 50 });
  });
});

describe('generatePanels', () => {
  it('generates one panel per wall plus a base plate for an empty box', () => {
    const project: Project = {
      id: 'p1',
      name: 'Test',
      config: baseConfig(),
      colors: [{ id: 'outer', color: '#888', heightMm: 60 }],
      zoneTree: { kind: 'leaf', id: 'only' },
    };
    const panels = generatePanels(project);

    // 4 outer walls + 1 base plate, no shelf.
    expect(panels).toHaveLength(5);
    expect(panels.filter((p) => p.kind === 'outerWall')).toHaveLength(4);
    expect(panels.filter((p) => p.kind === 'basePlate')).toHaveLength(1);
    expect(panels.every((p) => p.outline.length >= 4)).toBe(true);
  });

  it('adds one dividerWall panel per split, and skips the base plate when hasBottom is false', () => {
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
    const project: Project = {
      id: 'p1',
      name: 'Test',
      config: baseConfig({ hasBottom: false }),
      colors: [
        { id: 'outer', color: '#888', heightMm: 60 },
        { id: 'divider', color: '#f00', heightMm: 40 },
      ],
      zoneTree: root,
    };
    const panels = generatePanels(project);

    expect(panels.filter((p) => p.kind === 'dividerWall')).toHaveLength(1);
    expect(panels.filter((p) => p.kind === 'basePlate')).toHaveLength(0);
  });

  it('adds a shelf panel and its cleats when a shelf is configured', () => {
    const project: Project = {
      id: 'p1',
      name: 'Test',
      config: baseConfig({ shelf: { heightMm: 20, mode: 'removable' } }),
      colors: [{ id: 'outer', color: '#888', heightMm: 60 }],
      zoneTree: { kind: 'leaf', id: 'only' },
    };
    const panels = generatePanels(project);

    expect(panels.filter((p) => p.kind === 'shelf')).toHaveLength(1);
    expect(panels.filter((p) => p.kind === 'shelfCleat')).toHaveLength(4); // one per outer wall
  });
});
