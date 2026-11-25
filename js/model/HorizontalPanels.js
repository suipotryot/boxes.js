import { highestHorizontalPanelHeight } from './GridQuery.js';

const HORIZONTAL_PANEL_ID_PREFIX = 'horizontal-panel-';

export function horizontalPanelNumber(panel) {
  return Number(panel.id.slice(HORIZONTAL_PANEL_ID_PREFIX.length));
}

export function nextHorizontalPanelId(horizontalPanels) {
  const numbers = horizontalPanels.map(horizontalPanelNumber);
  return `${HORIZONTAL_PANEL_ID_PREFIX}${Math.max(0, ...numbers) + 1}`;
}

export function addHorizontalPanel(project) {
  const panel = { id: nextHorizontalPanelId(project.horizontalPanels), heightMm: highestHorizontalPanelHeight(project.grid, project), coverage: null };
  return { ...project, horizontalPanels: [...project.horizontalPanels, panel] };
}

function belongsToPiece(key, pieceId) {
  return key === pieceId || key.startsWith(`${pieceId}:`);
}

function withoutPieceEntries(entries, pieceId) {
  return Object.fromEntries(Object.entries(entries).filter(([key]) => !belongsToPiece(key, pieceId)));
}

export function removeHorizontalPanel(project, id) {
  return {
    ...project,
    horizontalPanels: project.horizontalPanels.filter((panel) => panel.id !== id),
    pieceHoles: withoutPieceEntries(project.pieceHoles, id),
    pieceNotches: withoutPieceEntries(project.pieceNotches, id),
  };
}

export function updateHorizontalPanel(project, id, changes) {
  return {
    ...project,
    horizontalPanels: project.horizontalPanels.map((panel) => (panel.id === id ? { ...panel, ...changes } : panel)),
  };
}

export function heightBroughtIntoRange(heightMm, { min, max }) {
  if (heightMm == null) return max;
  return Math.min(Math.max(heightMm, min), max);
}
