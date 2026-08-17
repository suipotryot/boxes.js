import { describe, expect, it } from 'vitest';

import { pointKey } from '../services/GeometryUtils';
import { classifyJunctions, junctionDegreeForWall } from '../services/JunctionClassifier';
import type { WallSegment } from '../models/WallSegment';

function wall(id: string, a: { x: number; y: number }, b: { x: number; y: number }): WallSegment {
  return { id, a, b, height: 40, thickness: 3, isOuter: false, colorId: 'c', notches: [] };
}

describe('classifyJunctions', () => {
  it('T-junction: a perpendicular wall touching the interior of a longer wall', () => {
    // W1 vertical, full span 0..100. W2 horizontal, touches W1's face at (0,50)
    // (W2's own west endpoint), stopping there (T stem, not crossing through).
    const w1 = wall('w1', { x: 0, y: 0 }, { x: 0, y: 100 });
    const w2 = wall('w2', { x: 0, y: 50 }, { x: 30, y: 50 });

    const junctions = classifyJunctions([w1, w2]);
    const info = junctions.get(pointKey({ x: 0, y: 50 }));

    expect(info).toBeDefined();
    // W1 passes through (0,50): both north and south reference it.
    expect(info!.north).toEqual({ segmentId: 'w1' });
    expect(info!.south).toEqual({ segmentId: 'w1' });
    // W2 only touches from its own west endpoint -> extends east from P.
    expect(info!.east).toEqual({ segmentId: 'w2' });
    expect(info!.west).toBeNull();

    // Degree on W1 (vertical -> perpendicular = east/west) is 1: a T-junction.
    expect(junctionDegreeForWall(info!, w1)).toBe(1);
  });

  it('X-crossing: one wall passing through plus two colinear segments meeting nose-to-nose', () => {
    // This is the realistic shape an X-crossing takes in this domain (see
    // WallExtractor): two *sibling* dividers (DA, DB) end up colinear and
    // meet exactly where a third, perpendicular wall passes through --
    // neither DA nor DB individually "passes through" the point, but
    // together they occupy both perpendicular sides, same as a single
    // through-wall would.
    const parent = wall('parent', { x: 0, y: 50 }, { x: 100, y: 50 }); // passes through (40,50)
    const da = wall('da', { x: 40, y: 0 }, { x: 40, y: 50 }); // ends at (40,50) from the north
    const db = wall('db', { x: 40, y: 50 }, { x: 40, y: 100 }); // ends at (40,50) from the south

    const junctions = classifyJunctions([parent, da, db]);
    const info = junctions.get(pointKey({ x: 40, y: 50 }));

    expect(info).toBeDefined();
    expect(info!.north).toEqual({ segmentId: 'da' });
    expect(info!.south).toEqual({ segmentId: 'db' });
    expect(info!.east).toEqual({ segmentId: 'parent' });
    expect(info!.west).toEqual({ segmentId: 'parent' });

    // From the through-wall's perspective, degree 2: an X-crossing.
    expect(junctionDegreeForWall(info!, parent)).toBe(2);
  });

  it('plain corner: two walls meeting endpoint-to-endpoint', () => {
    // West outer wall: vertical, north endpoint at (0,0), body extends south to (0,100).
    // North outer wall: horizontal, west endpoint at (0,0), body extends east to (100,0).
    const west = wall('west', { x: 0, y: 0 }, { x: 0, y: 100 });
    const north = wall('north', { x: 0, y: 0 }, { x: 100, y: 0 });

    const junctions = classifyJunctions([west, north]);
    const info = junctions.get(pointKey({ x: 0, y: 0 }));

    expect(info).toBeDefined();
    // west's own north endpoint is here -> it extends south from P.
    expect(info!.south).toEqual({ segmentId: 'west' });
    expect(info!.north).toBeNull();
    // north's own west endpoint is here -> it extends east from P.
    expect(info!.east).toEqual({ segmentId: 'north' });
    expect(info!.west).toBeNull();
  });

  it('produces one junction entry per distinct endpoint, deduplicated across walls', () => {
    const w1 = wall('w1', { x: 0, y: 0 }, { x: 0, y: 100 });
    const w2 = wall('w2', { x: 0, y: 100 }, { x: 100, y: 100 });
    const junctions = classifyJunctions([w1, w2]);
    // 4 distinct endpoints total, but (0,100) is shared by both walls -> 3 entries.
    expect(junctions.size).toBe(3);
  });

  it('KNOWN LIMITATION: 3+ collinear segments converging on the same side of one point last-write-wins', () => {
    // Three unrelated vertical segments (e.g. from unrelated branches of a
    // deeply nested zone tree) all happen to end, from the north, at the
    // same point -- a coincidence the plan flags as a hard case (M8, not
    // fixed here: JunctionInfo holds one ref per side, not a list). This
    // test exists to characterize the actual behavior (silent overwrite,
    // no crash, last-processed wall wins) rather than leave it undocumented.
    const w1 = wall('w1', { x: 0, y: 0 }, { x: 0, y: 50 });
    const w2 = wall('w2', { x: 0, y: 10 }, { x: 0, y: 50 });
    const w3 = wall('w3', { x: 0, y: 20 }, { x: 0, y: 50 });

    const junctions = classifyJunctions([w1, w2, w3]);
    const info = junctions.get(pointKey({ x: 0, y: 50 }))!;

    // Only the last-processed wall's contribution survives; w1 and w2's
    // presence at this point is silently lost rather than tracked.
    expect(info.north).toEqual({ segmentId: 'w3' });
  });

  it('GRID MODEL: 3 present segments along one line, crossed by 2 perpendicular lines, never collide (no known-limitation trigger)', () => {
    // Under the grid-line model (GridDivider.ts), a single vertical line
    // spanning the whole box and crossed by 2 horizontal lines produces
    // exactly this shape: 3 wall segments along the vertical line (vA, vB,
    // vC), each horizontal line itself split into 2 segments by the
    // vertical line (h1L/h1R, h2L/h2R). At each crossing point, only ONE
    // line per axis can ever be at that exact coordinate (MIN_GRID_SPACING_MM
    // forbids two same-axis lines from sharing a position), so at most one
    // wall segment contributes per side -- the "3+ unrelated segments on the
    // same side" limitation structurally cannot trigger here.
    const vA = wall('vA', { x: 50, y: 0 }, { x: 50, y: 30 });
    const vB = wall('vB', { x: 50, y: 30 }, { x: 50, y: 70 });
    const vC = wall('vC', { x: 50, y: 70 }, { x: 50, y: 100 });
    const h1L = wall('h1L', { x: 0, y: 30 }, { x: 50, y: 30 });
    const h1R = wall('h1R', { x: 50, y: 30 }, { x: 100, y: 30 });
    const h2L = wall('h2L', { x: 0, y: 70 }, { x: 50, y: 70 });
    const h2R = wall('h2R', { x: 50, y: 70 }, { x: 100, y: 70 });

    const junctions = classifyJunctions([vA, vB, vC, h1L, h1R, h2L, h2R]);

    const at30 = junctions.get(pointKey({ x: 50, y: 30 }))!;
    expect(at30).toEqual({ point: { x: 50, y: 30 }, north: { segmentId: 'vA' }, south: { segmentId: 'vB' }, east: { segmentId: 'h1R' }, west: { segmentId: 'h1L' } });
    expect(junctionDegreeForWall(at30, vA)).toBe(2); // full X-crossing: vA/vB continue through, h1L/h1R continue through
    expect(junctionDegreeForWall(at30, h1L)).toBe(2);

    const at70 = junctions.get(pointKey({ x: 50, y: 70 }))!;
    expect(at70).toEqual({ point: { x: 50, y: 70 }, north: { segmentId: 'vB' }, south: { segmentId: 'vC' }, east: { segmentId: 'h2R' }, west: { segmentId: 'h2L' } });
    expect(junctionDegreeForWall(at70, vC)).toBe(2);
  });
});

describe('junctionDegreeForWall', () => {
  it('is 0 when neither perpendicular side is occupied', () => {
    const info = { point: { x: 0, y: 0 }, north: null, south: null, east: null, west: null };
    const vertical = wall('v', { x: 0, y: 0 }, { x: 0, y: 10 });
    expect(junctionDegreeForWall(info, vertical)).toBe(0);
  });
});
