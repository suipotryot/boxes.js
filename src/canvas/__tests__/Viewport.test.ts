import { describe, expect, it } from 'vitest';

import { computeFitToView, zoomAtPoint } from '../Viewport';

describe('computeFitToView', () => {
  it('scales to fit the limiting dimension and centers the content', () => {
    // Content 100x50 (2:1), viewport 800x600, margin 0 -> width-limited.
    const viewport = computeFitToView(100, 50, 800, 600, 0);
    expect(viewport.scale).toBeCloseTo(8, 6); // 800/100
    expect(viewport.offsetX).toBeCloseTo(0, 6);
    expect(viewport.offsetY).toBeCloseTo((600 - 50 * 8) / 2, 6);
  });

  it('is height-limited when the content is relatively tall', () => {
    const viewport = computeFitToView(50, 100, 800, 600, 0);
    expect(viewport.scale).toBeCloseTo(6, 6); // 600/100
  });

  it('reserves the margin on every side', () => {
    const viewport = computeFitToView(100, 100, 500, 500, 40);
    // Available = 500 - 80 = 420 -> scale = 420/100 = 4.2
    expect(viewport.scale).toBeCloseTo(4.2, 6);
  });
});

describe('zoomAtPoint', () => {
  it('keeps the content point under the cursor fixed after zooming in', () => {
    const viewport = { scale: 2, offsetX: 10, offsetY: 10 };
    const pointer = { x: 110, y: 60 };
    const contentBefore = { x: (pointer.x - viewport.offsetX) / viewport.scale, y: (pointer.y - viewport.offsetY) / viewport.scale };

    const next = zoomAtPoint(viewport, pointer, 1.5);
    const contentAfter = { x: (pointer.x - next.offsetX) / next.scale, y: (pointer.y - next.offsetY) / next.scale };

    expect(next.scale).toBeCloseTo(3, 6);
    expect(contentAfter.x).toBeCloseTo(contentBefore.x, 6);
    expect(contentAfter.y).toBeCloseTo(contentBefore.y, 6);
  });

  it('clamps to the minimum and maximum scale', () => {
    const viewport = { scale: 1, offsetX: 0, offsetY: 0 };
    expect(zoomAtPoint(viewport, { x: 0, y: 0 }, 0.0001).scale).toBeGreaterThan(0);
    expect(zoomAtPoint(viewport, { x: 0, y: 0 }, 100000).scale).toBeLessThan(1000);
  });
});
