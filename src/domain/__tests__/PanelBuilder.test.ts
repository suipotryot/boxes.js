import { describe, expect, it } from 'vitest';

import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { GridLine } from '../models/Grid';
import type { ProjectConfig } from '../models/Project';
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

  it('places the panel origin at the base plate top (z = outerThickness), not the absolute floor, when hasBottom is true', () => {
    // The panel's own v=0 baseline rests on the base plate's *top* face.
    // The base plate itself spans world z=[0, outerThickness] (see
    // BasePlateBuilder/MeshBuilders), so if origin.z stayed at 0, the
    // finger tabs (which reach v=-outerThickness, i.e. world z=-outerThickness
    // below origin.z) would land entirely below the base plate instead of
    // passing through it.
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
    const config = baseConfig({ hasBottom: true, outerThickness: 5 });
    const panel = buildWallPanel(wall, [wall], junctions, config);
    expect(panel.placement3d?.origin.z).toBe(5);
  });

  it('keeps the panel origin at the absolute floor (z = 0) when there is no base plate', () => {
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
    const config = baseConfig({ hasBottom: false });
    const panel = buildWallPanel(wall, [wall], junctions, config);
    expect(panel.placement3d?.origin.z).toBe(0);
  });
});

describe('buildWallPanel: single-split box (T-junctions at both ends of the divider)', () => {
  const colors = new ColorHeightRegistry([
    { id: 'outer', color: '#888', heightMm: 60 },
    { id: 'divider', color: '#f00', heightMm: 40 },
  ]);
  const config = baseConfig({ outerColorId: 'outer', hasBottom: true });
  // centerX = firstSize(40) + innerThickness/2(1) = 41, matching the old
  // tree model's split geometry exactly for this config.
  const line: GridLine = { id: 'v1', axis: 'x', positionMm: 41, colorId: 'divider', segmentOverrides: [] };
  const walls = extract({
    grid: { lines: [line] },
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
    // height, so the comb protrusion shows up across the entire end edges,
    // and the top stays flush at v=40 (no "flush beyond comb" segment,
    // since there's nothing left over). The protrusion depth is half the
    // *mate's* thickness (the outer wall here), not the divider's own --
    // config.outerThickness/2 happens to equal config.innerThickness in
    // this particular config (4/2=2), see the dedicated asymmetric-
    // thickness test below for a config where that coincidence doesn't
    // paper over a wrong formula.
    expect(box.maxY).toBeCloseTo(40, 6);
    expect(box.minX).toBeCloseTo(-config.outerThickness / 2, 6);
    expect(box.maxX).toBeCloseTo(length + config.outerThickness / 2, 6);
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

describe('buildWallPanel: compound edge protrusion depth', () => {
  it('protrudes by half the *mate\'s* thickness, not this wall\'s own thickness', () => {
    // outerThickness (5) is not double innerThickness (2) here, so the two
    // possible formulas (mate.thickness/2 vs wall.thickness) give visibly
    // different answers (2.5 vs 2) -- pins down which one is actually used.
    // Regression for a bug where a wall's own end-edge tabs protruded by
    // its own full thickness, past the mate's own outer face, instead of
    // stopping flush with it (looked like teeth "added on top" rather than
    // interlocked in 3D).
    const colors = new ColorHeightRegistry([
      { id: 'outer', color: '#888', heightMm: 60 },
      { id: 'divider', color: '#f00', heightMm: 60 },
    ]);
    const config = baseConfig({ outerColorId: 'outer', outerThickness: 5, innerThickness: 2, hasBottom: true });
    const line: GridLine = { id: 'v1', axis: 'x', positionMm: 41, colorId: 'divider', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [line] },
      innerRect: { x: 0, y: 0, width: 100, height: 50 },
      outerThickness: config.outerThickness,
      innerThickness: config.innerThickness,
      outerColorId: config.outerColorId,
      colors,
    });
    const junctions = classifyJunctions(walls);
    const divider = walls.find((w) => !w.isOuter)!;

    const panel = buildWallPanel(divider, walls, junctions, config);
    const box = boundingBox(panel.outline);
    const length = wallLength(divider);

    expect(box.minX).toBeCloseTo(-config.outerThickness / 2, 6);
    expect(box.maxX).toBeCloseTo(length + config.outerThickness / 2, 6);
  });

  it('retracts a SPACE band to the mate\'s near face, not its centerline, so it never collides with the mate\'s own finger there', () => {
    // Regression for the bug matching the user's own diagnosis: reaching
    // only to the mate's centerline for space/flush bands (the previous
    // behavior) left a permanent thisWall.thickness/2 x mate.thickness/2
    // sliver double-claimed by both walls at every junction, regardless of
    // finger/space phase -- visible in 3D as "teeth crossing within the
    // thickness" at every corner, not an isolated edge case.
    const wallA: WallSegment = { id: 'a', a: { x: 0, y: 0 }, b: { x: 0, y: 30 }, height: 20, thickness: 2, isOuter: false, colorId: 'c', notches: [] };
    const wallB: WallSegment = { id: 'b', a: { x: 0, y: 30 }, b: { x: 50, y: 30 }, height: 20, thickness: 4, isOuter: false, colorId: 'c', notches: [] };
    const walls = [wallA, wallB];
    const junctions = classifyJunctions(walls);
    const config = baseConfig({
      advanced: {
        ...baseConfig().advanced,
        fingerJoint: { style: 'rectangular', fingerMm: 10, spaceMm: 10, widthMm: 2, edgeWidthMm: 0, playMm: 0, extraLengthMm: 0, surroundingSpaces: 0 },
      },
    });

    const panel = buildWallPanel(wallA, walls, junctions, config);
    // wallA's RIGHT end (u=length=30) mates with wallB (thickness 4,
    // protrusionDepth=2), 'a' < 'b' -> starts with a finger: finger band
    // v=[0,10] at u=length+2=32 (through the mate's full thickness),
    // space band v=[10,20] at u=length-2=28 (retracted to the mate's near
    // face -- NOT u=30, the old buggy "reach only to centerline" value).
    const hasPoint = (x: number, y: number) => panel.outline.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
    expect(hasPoint(32, 0)).toBe(true);
    expect(hasPoint(32, 10)).toBe(true);
    expect(hasPoint(28, 10)).toBe(true);
    expect(hasPoint(28, 20)).toBe(true);
    // (30,10) would only appear if the space band still reached the bare
    // centerline (the bug); NOTE (30,20) legitimately exists regardless --
    // that's buildTopEdge's own flat span (u=length, v=height), unrelated
    // to this end-edge comb.
    expect(hasPoint(30, 10)).toBe(false);
  });
});

describe('buildWallPanel: X-crossing half-lap notch', () => {
  it('carves a notch of depth min(heightA, heightB)/2 into the through-wall, from either its top or its bottom', () => {
    // NOTE: under the grid-line divider model, a grid line is always cut
    // into separate wall segments at EVERY point a perpendicular line
    // crosses it (see WallExtractor/GridDivider) -- so WallExtractor's
    // own output can no longer produce a wall that passes through an
    // interior crossing point uncut (which is what findXCrossingNotches
    // requires: junction strictly interior to the wall's own u-span, not
    // at one of its own endpoints). That scenario was only reachable in
    // the old recursive-split model, where a sibling divider confined to
    // half the box could touch a longer, uncut ancestor divider's face
    // without cutting it. The half-lap notch mechanism itself is still
    // intact code (unchanged), so this test exercises it directly against
    // a hand-built WallSegment[] -- mirroring how JunctionClassifier's own
    // X-crossing test constructs walls -- rather than through extract().
    const config = baseConfig({ outerColorId: 'outer', hasBottom: true });
    const rootDivider: WallSegment = { id: 'root', a: { x: 41, y: -2 }, b: { x: 41, y: 102 }, height: 40, thickness: 2, isOuter: false, colorId: 'divider', notches: [] };
    const da: WallSegment = { id: 'da', a: { x: -2, y: 21 }, b: { x: 41, y: 21 }, height: 40, thickness: 2, isOuter: false, colorId: 'divider', notches: [] };
    const db: WallSegment = { id: 'db', a: { x: 41, y: 21 }, b: { x: 102, y: 21 }, height: 40, thickness: 2, isOuter: false, colorId: 'divider', notches: [] };
    const walls = [rootDivider, da, db];
    const junctions = classifyJunctions(walls);

    const panel = buildWallPanel(rootDivider, walls, junctions, config);
    const expectedDepth = 40 / 2; // min(40,40)/2, both siblings are height 40

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

describe('buildWallPanel: outline closes cleanly when a wall is taller than a neighbour it butts against', () => {
  it('does not splice a spurious straight jump across the comb at the taller wall\'s compound edge', () => {
    // A wall's own end-edge comb only gets an extra "flush above the comb"
    // point when it is *taller* than whatever it meets there (combHeight <
    // wall.height) -- outer walls never hit this among themselves (they
    // all share one height), but two dividers of different heights readily
    // can. Regression for a bug where the outline's own `left` segment was
    // reversed twice (once inside buildEndEdge, once again when assembling
    // the outline), which happened to cancel out whenever there was no
    // extra flush point, but otherwise spliced a straight line straight
    // across the comb and left the polygon not closing back onto itself.
    const colors = new ColorHeightRegistry([
      { id: 'outer', color: '#888', heightMm: 60 },
      { id: 'short', color: '#0f0', heightMm: 40 },
      { id: 'tall', color: '#f00', heightMm: 55 },
    ]);
    const config = baseConfig({ outerColorId: 'outer', hasBottom: true });
    // v1 (short, height 40) and h1 (tall, height 55) cross at x=41; h1 gets
    // cut into 2 segments there (every grid line is cut at every crossing
    // -- see WallExtractor). The segment starting AT that crossing (its own
    // u=0 / 'left' end) is the one whose left-end comb butts a shorter
    // neighbour (combHeight = min(55,40) = 40 < 55) -- exactly the
    // regression condition (the old bug was specific to the 'left' side's
    // double-reversal, so it must be exercised there, not just anywhere
    // height===55 happens to appear).
    const v1: GridLine = { id: 'v1', axis: 'x', positionMm: 41, colorId: 'short', segmentOverrides: [] };
    const h1: GridLine = { id: 'h1', axis: 'y', positionMm: 21, colorId: 'tall', segmentOverrides: [] };
    const walls = extract({
      grid: { lines: [v1, h1] },
      innerRect: { x: 0, y: 0, width: 100, height: 100 },
      outerThickness: config.outerThickness,
      innerThickness: config.innerThickness,
      outerColorId: config.outerColorId,
      colors,
    });
    const junctions = classifyJunctions(walls);
    const childDivider = walls.find((w) => !w.isOuter && w.height === 55 && Math.abs(w.a.x - 41) < 1e-6)!;

    const panel = buildWallPanel(childDivider, walls, junctions, config);

    // The bug's signature: the outline's last point stopped landing back on
    // its own first point -- the extra reversal sent the `left` segment the
    // wrong way, so the loop never closed onto its own start.
    const first = panel.outline[0]!;
    const last = panel.outline[panel.outline.length - 1]!;
    expect(last.x).toBeCloseTo(first.x, 6);
    expect(last.y).toBeCloseTo(first.y, 6);

    // And the bug also spliced a single straight *vertical* segment running
    // the wall's (near-)full height, cutting right across the left end
    // edge's comb -- a valid comb never has a single vertical edge that
    // tall (a finger/space span is bounded by the finger-joint settings,
    // well under the wall's own height). Horizontal (u-direction) segments
    // are excluded: an uncrossed top/bottom edge can legitimately run the
    // wall's full length in one straight line.
    const maxVerticalSegment = Math.max(
      0,
      ...panel.outline
        .slice(1)
        .map((p, i) => ({ dx: Math.abs(p.x - panel.outline[i]!.x), dy: Math.abs(p.y - panel.outline[i]!.y) }))
        .filter(({ dx }) => dx < 1e-6)
        .map(({ dy }) => dy),
    );
    expect(maxVerticalSegment).toBeLessThan(childDivider.height * 0.9);
  });
});
