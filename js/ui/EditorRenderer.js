// Renders the grid as real DOM <svg> elements — a <line> per wall segment,
// a <rect> per cell behind them — with native event listeners. The browser
// does the hit-testing; there's no manual picking code and no redraw loop
// to keep in sync with model state, unlike a Canvas-based editor.
import { svgEl } from './dom.js';
import { xAt, yAt } from '../model/GridQuery.js';

const PAD_MM = 15;

function addWallSegment(target, grid, kind, c, r, x1, y1, x2, y2, selected, onSelect) {
  const seg = kind === 'v' ? grid.vWalls[c][r] : grid.hWalls[c][r];
  const isSelected = !!selected && selected.kind === kind && selected.c === c && selected.r === r;
  const classes = ['wall-line', seg.present ? 'present' : 'absent', `group-${seg.thicknessGroup}`];
  if (isSelected) classes.push('selected');
  const onClick = (evt) => {
    evt.stopPropagation();
    onSelect({ kind, c, r });
  };
  target.push(svgEl('g', { class: 'wall-segment', 'data-key': `${kind}-${c}-${r}`, onClick }, [
    svgEl('line', { x1, y1, x2, y2, class: 'wall-hit' }),
    svgEl('line', { x1, y1, x2, y2, class: classes.join(' ') }),
  ]));
}

/**
 * @param {object} project
 * @param {{kind:'v'|'h', c:number, r:number}|null} selected
 * @param {(next:{kind:'v'|'h',c:number,r:number}) => void} onSelect
 */
export function renderEditorSvg(project, selected, onSelect) {
  const grid = project.grid;
  const cols = grid.sx.length;
  const rows = grid.sy.length;
  const width = xAt(grid, project, cols);
  const height = yAt(grid, project, rows);

  const cellRects = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      cellRects.push(svgEl('rect', {
        x: xAt(grid, project, c), y: yAt(grid, project, r), width: grid.sx[c], height: grid.sy[r], class: 'grid-cell',
      }));
    }
  }

  const segments = [];
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      addWallSegment(segments, grid, 'v', c, r, xAt(grid, project, c), yAt(grid, project, r), xAt(grid, project, c), yAt(grid, project, r + 1), selected, onSelect);
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows; r++) {
      addWallSegment(segments, grid, 'h', c, r, xAt(grid, project, c), yAt(grid, project, r), xAt(grid, project, c + 1), yAt(grid, project, r), selected, onSelect);
    }
  }

  return svgEl('svg', {
    viewBox: `${-PAD_MM} ${-PAD_MM} ${width + PAD_MM * 2} ${height + PAD_MM * 2}`,
    class: 'editor-svg',
  }, [...cellRects, ...segments]);
}
