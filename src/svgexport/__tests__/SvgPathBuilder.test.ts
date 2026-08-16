import { describe, expect, it } from 'vitest';

import type { Panel } from '@/domain/models/Panel';
import { buildPanelPath } from '../SvgPathBuilder';

function panel(outline: { x: number; y: number }[], holes: { x: number; y: number }[][] = []): Panel {
  return {
    id: 'p1',
    kind: 'dividerWall',
    materialThickness: 3,
    outline,
    holes,
    sourceIds: [],
  };
}

describe('buildPanelPath', () => {
  it('produces one M/Z subpath for the outline with no burn correction', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const path = buildPanelPath(panel(square), 0, 'corner');
    expect(path).toBe('M 0 0 L 10 0 L 10 10 L 0 10 Z');
  });

  it('produces one subpath per hole, after the outline', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const hole = [
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ];
    const path = buildPanelPath(panel(square, [hole]), 0, 'corner');
    const subpaths = path.split(' Z').filter((s) => s.trim().length > 0);
    expect(subpaths).toHaveLength(2);
    expect(path).toContain('M 2 2');
  });

  it('applies burn correction before serializing (outer corner pushed out)', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const path = buildPanelPath(panel(square), 1, 'corner');
    expect(path).toBe('M -1 -1 L 11 -1 L 11 11 L -1 11 Z');
  });

  it('rounds coordinates to a sane precision (no float noise in the output)', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const path = buildPanelPath(panel(square), 0.1, 'corner');
    expect(path).not.toMatch(/\d+\.\d{4,}/);
  });
});
