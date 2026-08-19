import { createM1ExampleProject } from './state/Project.js';
import { computePieces } from './geometry/PieceFactory.js';
import { pieceToSvgElement, pieceBounds } from './geometry/SvgPath.js';

const project = createM1ExampleProject();
const pieces = computePieces(project);

const container = document.getElementById('pieces');
const PADDING = 10;

for (const piece of pieces) {
  const bounds = pieceBounds(piece);

  const card = document.createElement('div');
  card.className = 'piece-card';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const w = bounds.width + PADDING * 2;
  const h = bounds.height + PADDING * 2;
  svg.setAttribute('viewBox', `${bounds.minX - PADDING} ${bounds.minY - PADDING} ${w} ${h}`);
  svg.setAttribute('width', Math.max(80, w));
  svg.setAttribute('height', Math.max(80, h));
  svg.appendChild(pieceToSvgElement(piece));
  card.appendChild(svg);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = `${piece.id} — ${piece.thicknessMm}mm — ${Math.round(bounds.width)}×${Math.round(bounds.height)}mm`;
  card.appendChild(label);

  container.appendChild(card);
}
