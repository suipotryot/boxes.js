import { describe, expect, it } from 'vitest';

import type { Panel } from '@/domain/models/Panel';
import { renderSvgPage } from '../SvgPageRenderer';

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

describe('renderSvgPage', () => {
  it('produces a valid SVG document sized to the laser bed', () => {
    const svg = renderSvgPage([{ panel: rectPanel('a', 20, 10), x: 5, y: 5, rotated: false }], 300, 200, 3, 0, 'corner', 'page 1/1');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="300mm" height="200mm"');
    expect(svg).toContain('viewBox="0 0 300 200"');
  });

  it('emits one <g> per placed panel', () => {
    const placed = [
      { panel: rectPanel('a', 20, 10), x: 0, y: 0, rotated: false },
      { panel: rectPanel('b', 15, 15), x: 25, y: 0, rotated: false },
    ];
    const svg = renderSvgPage(placed, 300, 200, 3, 0, 'corner', 'page 1/1');
    expect(svg.match(/<g /g)).toHaveLength(2);
  });

  it('includes a thickness and page label outside any panel path', () => {
    const svg = renderSvgPage([], 300, 200, 4.5, 0, 'corner', 'page 2/3');
    expect(svg).toContain('page 2/3');
    expect(svg).toContain('4.5mm');
  });

  it('translates a non-rotated panel so its bounding box origin lands at its placed (x,y)', () => {
    const svg = renderSvgPage([{ panel: rectPanel('a', 20, 10), x: 7, y: 3, rotated: false }], 300, 200, 3, 0, 'corner', 'p');
    expect(svg).toContain('transform="translate(7 3)"');
  });

  it('escapes special characters in the page label', () => {
    const svg = renderSvgPage([], 300, 200, 3, 0, 'corner', '<script>');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
  });
});
