import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { ProjectConfig } from '../models/Project';
import type { ZoneSplit } from '../models/Zone';
import type { WallSegment } from '../models/WallSegment';
import { classifyJunctions } from '../services/JunctionClassifier';
import { buildWallPanel, wallLength } from '../services/PanelBuilder';
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

function boundingBox(points: { x: number; y: number }[]) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
  };
}

describe('buildWallPanel: standalone wall (no neighbors, no bottom)', () => {
  it('produces a plain rectangle outline matching length x height', () => {
    const colors = new ColorHeightRegistry([{ id: 'c', color: '#f00', heightMm: 40 }]);
    const wall: WallSegment = {
      id: 'w1',
      a: { x: 0, y: 0 },
      b: { x: 80, y: 0 },
      height: 40,
      thickness: 3,
      isOuter: false,
      colorId: 'c',
      notches: [],
    };
    const junctions = classifyJunctions([wall]);
    const config = baseConfig({ hasBottom: false, outerColorId: 'c' });
    const panel = buildWallPanel(wall, [wall], junctions, config);
    const box = boundingBox(panel.outline);

    expect(box).toEqual({ minX: 0, maxX: 80, minY: 0, maxY: 40 });
    expect(panel.holes).toHaveLength(0);
    void colors;
  });

  it('protrudes below y=0 on the bottom edge when hasBottom is true', () => {
    const wall: WallSegment = {
      id: 'w1',
      a: { x: 0, y: 0 },
      b: { x: 80, y: 0 },
      height: 40,
      thickness: 3,
      isOuter: false,
      colorId: 'c',
      notches: [],
    };
    const junctions = classifyJunctions([wall]);
    const config = baseConfig({ hasBottom: true });
    const panel = buildWallPanel(wall, [wall], junctions, config);
    const box = boundingBox(panel.outline);

    expect(box.minY).toBeCloseTo(-config.outerThickness, 6);
    expect(box.maxY).toBeCloseTo(40, 6);
  });
});

describe('buildWallPanel: single-split box (T-junctions at both ends of the divider)', () => {
  const colors = new ColorHeightRegistry([
    { id: 'outer', color: '#888', heightMm: 60 },
    { id: 'divider', color: '#f00', heightMm: 40 },
  ]);
  const config = baseConfig({ outerColorId: 'outer', hasBottom: true });
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
    innerRect: { x: 0, y: 0, width: 100, height: 50 },
    outerThickness: config.outerThickness,
    innerThickness: config.innerThickness,
    outerColorId: config.outerColorId,
    colors,
  });
  const junctions = classifyJunctions(walls);
  const divider = walls.find((w) => !w.isOuter)!;
  const south = walls.find((w) => w.isOuter && approxEqualY(w, 52))!;

  function approxEqualY(w: WallSegment, y: number): boolean {
    return Math.abs(w.a.y - y) < 1e-6 && Math.abs(w.b.y - y) < 1e-6;
  }

  it('combs the divider panel fully at both ends since it is the shorter wall (compound edge)', () => {
    const panel = buildWallPanel(divider, walls, junctions, config);
    const box = boundingBox(panel.outline);
    const length = wallLength(divider);
    // Divider height (40) < outer wall height (60) -> combHeight = 40 = full
    // height, so the comb protrusion (by the divider's own thickness) shows
    // up across the entire end edges, and the top stays flush at v=40 (no
    // "flush beyond comb" segment, since there's nothing left over).
    expect(box.maxY).toBeCloseTo(40, 6);
    expect(box.minX).toBeCloseTo(-config.innerThickness, 6);
    expect(box.maxX).toBeCloseTo(length + config.innerThickness, 6);
  });

  it('cuts a matching row of finger holes into the carrying outer wall face', () => {
    const panel = buildWallPanel(south, walls, junctions, config);
    expect(panel.holes.length).toBeGreaterThan(0);
    // Every hole must sit within the divider's own height (0..40) and be
    // centered around the divider's crossing position on the south wall.
    const dividerU = Math.abs(divider.b.x - south.a.x); // south wall runs west->east from a
    for (const hole of panel.holes) {
      const xs = hole.map((p) => p.x);
      const ys = hole.map((p) => p.y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(40 + 1e-6);
      expect(Math.min(...xs)).toBeGreaterThan(dividerU - 10);
      expect(Math.max(...xs)).toBeLessThan(dividerU + 10);
    }
  });
});

describe('buildWallPanel: X-crossing half-lap notch', () => {
  it('carves a notch of depth min(heightA, heightB)/2 into the through-wall, from either its top or its bottom', () => {
    const colors = new ColorHeightRegistry([
      { id: 'outer', color: '#888', heightMm: 60 },
      { id: 'divider', color: '#f00', heightMm: 40 },
    ]);
    const config = baseConfig({ outerColorId: 'outer', hasBottom: true });
    // Root x-split at 40; both children get a y-split at the same offset (20)
    // so their dividers are collinear and meet nose-to-nose against the
    // root divider -> a genuine X-crossing on the root divider.
    const root: ZoneSplit = {
      kind: 'split',
      id: 'root',
      axis: 'x',
      firstSize: 40,
      dividerColorId: 'divider',
      notches: [],
      first: {
        kind: 'split',
        id: 'left-split',
        axis: 'y',
        firstSize: 20,
        dividerColorId: 'divider',
        notches: [],
        first: { kind: 'leaf', id: 'top-left' },
        second: { kind: 'leaf', id: 'bottom-left' },
      },
      second: {
        kind: 'split',
        id: 'right-split',
        axis: 'y',
        firstSize: 20,
        dividerColorId: 'divider',
        notches: [],
        first: { kind: 'leaf', id: 'top-right' },
        second: { kind: 'leaf', id: 'bottom-right' },
      },
    };
    const walls = extract({
      zoneTree: root,
      innerRect: { x: 0, y: 0, width: 100, height: 100 },
      outerThickness: config.outerThickness,
      innerThickness: config.innerThickness,
      outerColorId: config.outerColorId,
      colors,
    });
    const junctions = classifyJunctions(walls);
    // The root divider is the one spanning the full height (the "through" wall).
    const rootDivider = walls
      .filter((w) => !w.isOuter)
      .reduce((a, b) => (wallLength(a) > wallLength(b) ? a : b));

    const panel = buildWallPanel(rootDivider, walls, junctions, config);
    const expectedDepth = 40 / 2; // min(40,40)/2, both dividers are height 40

    // A notch is a *localized* dip -- it won't move the overall bounding
    // box if the rest of that edge still reaches the extreme elsewhere, so
    // look for the actual notch-floor point instead: either the top was
    // carved down to 40-depth, or the bottom was carved up to
    // -outerThickness+depth (from the comb protrusion baseline).
    const hasPointNear = (y: number) => panel.outline.some((p) => Math.abs(p.y - y) < 1e-6);
    const topCarved = hasPointNear(40 - expectedDepth);
    const bottomCarved = hasPointNear(-config.outerThickness + expectedDepth);
    expect(topCarved !== bottomCarved).toBe(true);
  });
});
