import { describe, expect, it } from 'vitest';

import type { Panel } from '@/domain/models/Panel';
import { MaxRectsBin, packThicknessGroup } from '../MaxRectsPacker';
import type { PlacedRect } from '../types';

function rectsOverlap(a: PlacedRect, b: PlacedRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

describe('MaxRectsBin', () => {
  it('places the first piece at the bin origin', () => {
    const bin = new MaxRectsBin(100, 100);
    const placed = bin.insert(30, 20, false);
    expect(placed).toEqual({ x: 0, y: 0, width: 30, height: 20, rotated: false });
  });

  it('returns null when a piece cannot fit at all', () => {
    const bin = new MaxRectsBin(50, 50);
    expect(bin.insert(60, 10, false)).toBeNull();
  });

  it('rotates a piece that only fits the bin when rotated', () => {
    const bin = new MaxRectsBin(10, 20);
    const placed = bin.insert(15, 5, true)!;
    expect(placed.rotated).toBe(true);
    expect(placed.width).toBe(5);
    expect(placed.height).toBe(15);
  });

  it('refuses to rotate when rotation is disallowed, even if that would fit', () => {
    const bin = new MaxRectsBin(10, 20);
    expect(bin.insert(15, 5, false)).toBeNull();
  });

  it('never overlaps two placed pieces, across a sequence of insertions of varying sizes', () => {
    const bin = new MaxRectsBin(200, 150);
    const sizes: [number, number][] = [
      [80, 60],
      [50, 50],
      [40, 90],
      [30, 30],
      [60, 20],
      [20, 20],
      [70, 40],
    ];
    const placed: PlacedRect[] = [];
    for (const [w, h] of sizes) {
      const p = bin.insert(w, h, true);
      if (p) placed.push(p);
    }
    expect(placed.length).toBeGreaterThan(0);
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(rectsOverlap(placed[i]!, placed[j]!)).toBe(false);
      }
    }
  });

  it('keeps every placed piece fully within the bin bounds', () => {
    const bin = new MaxRectsBin(100, 80);
    const placed: PlacedRect[] = [];
    for (let i = 0; i < 10; i++) {
      const p = bin.insert(15 + i, 12, true);
      if (p) placed.push(p);
    }
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(100);
      expect(p.y + p.height).toBeLessThanOrEqual(80);
    }
  });

  it('fills the bin exactly with a piece matching its full size, then rejects anything else', () => {
    const bin = new MaxRectsBin(50, 40);
    expect(bin.insert(50, 40, false)).toEqual({ x: 0, y: 0, width: 50, height: 40, rotated: false });
    expect(bin.insert(1, 1, false)).toBeNull();
  });
});

function rectPanel(id: string, width: number, height: number): Panel {
  return {
    id,
    kind: 'dividerWall',
    materialThickness: 3,
    outline: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    holes: [],
    sourceIds: [],
  };
}

describe('packThicknessGroup', () => {
  it('places every panel exactly once when they all fit on one page', () => {
    const panels = [rectPanel('a', 30, 20), rectPanel('b', 40, 10), rectPanel('c', 20, 20)];
    const pages = packThicknessGroup(panels, 200, 150, 2, true);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.map((p) => p.panel.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('spills onto a second page when panels no longer fit on one bed', () => {
    const panels = [rectPanel('a', 90, 90), rectPanel('b', 90, 90), rectPanel('c', 90, 90)];
    const pages = packThicknessGroup(panels, 100, 100, 0, false);
    const allIds = pages.flatMap((page) => page.map((p) => p.panel.id));
    expect(allIds.sort()).toEqual(['a', 'b', 'c']);
    expect(pages.length).toBeGreaterThan(1);
  });

  it('never overlaps two panels placed on the same page, accounting for rotation', () => {
    const panels = [
      rectPanel('a', 80, 30),
      rectPanel('b', 30, 80),
      rectPanel('c', 50, 50),
      rectPanel('d', 20, 90),
      rectPanel('e', 60, 25),
    ];
    const pages = packThicknessGroup(panels, 150, 150, 3, true);
    for (const page of pages) {
      const rects = page.map((p) => {
        const box = p.panel.outline.reduce(
          (acc, pt) => ({ w: Math.max(acc.w, pt.x), h: Math.max(acc.h, pt.y) }),
          { w: 0, h: 0 },
        );
        const width = p.rotated ? box.h : box.w;
        const height = p.rotated ? box.w : box.h;
        return { x: p.x, y: p.y, width, height };
      });
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i]!;
          const b = rects[j]!;
          const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
          expect(overlap).toBe(false);
        }
      }
    }
  });

  it('throws when a single panel cannot fit the bed even alone', () => {
    const panels = [rectPanel('too-big', 500, 500)];
    expect(() => packThicknessGroup(panels, 100, 100, 0, false)).toThrow();
  });

  it('returns no pages for an empty panel list', () => {
    expect(packThicknessGroup([], 100, 100, 0, false)).toEqual([]);
  });
});
