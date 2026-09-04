// Hosts two independent sections in the same sidebar panel: the grid
// SEGMENT fields (present/height/thickness — a click on the editor grid
// selects a segment, see EditorView, but never mutates it directly, so
// "select" and "toggle" are never the same ambiguous click), and the grip-
// notch editor (GripNotchEditor.js) for whichever WALL PIECE is selected.
// These two selections are independent (EditorView.js's `selected` vs
// `selectedWallId`) because a drawer sleeve's own walls have no grid
// segment to click at all — the only way to reach one is a preview-strip
// card click, which sets `selectedWallId` alone.
import { el } from './dom.js';
import { toggleWall, setSegmentHeight, isOuterSegment } from '../model/Grid.js';
import { resolveHeight, resolveThickness } from '../model/GridQuery.js';
import { resolveWallRunContext, resolvePieceHoleContext } from '../geometry/PieceContext.js';
import { heightProfile } from '../model/GridQuery.js';
import { buildWallPiece, buildBasePlate, buildLid } from '../geometry/oo/Assembly.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { pieceToStandaloneSvg } from '../geometry/SvgPath.js';
import { Cutout } from '../geometry/oo/Cutout.js';
import { Hole } from '../geometry/oo/Hole.js';
import { Notch } from '../geometry/oo/Notch.js';
import { attachHoleDragOverlay } from './HoleDragOverlay.js';
import { attachNotchDragOverlay } from './NotchDragOverlay.js';
import { renderGripNotchSection } from './GripNotchEditor.js';
import { renderHoleSection } from './HoleEditor.js';
import { t } from '../i18n/index.js';

function kindLabel(kind) {
  return kind === 'v' ? t('inspector.kindVertical') : t('inspector.kindHorizontal');
}

// The single, real-pipeline piece build shared by the top preview — keyed
// off holeContext (never wallContext): both resolvers (PieceContext.js)
// key off the identical enumerateWallRuns(...).find(...) lookup, so for
// any wall they always resolve in lockstep, and holeContext is a strict
// superset of wallContext (same run/grid/project, plus `kind`) — while
// holeContext is the ONLY one that ever resolves for the base plate/lid,
// which have no wall run at all. Keying this off wallContext instead would
// silently produce no preview for those two pieces.
function buildInspectedPiece(holeContext) {
  const panel = holeContext.kind === 'wall'
    ? buildWallPiece(holeContext.run, holeContext.grid, holeContext.project)
    : holeContext.rawId === 'base-plate'
      ? buildBasePlate(holeContext.grid, holeContext.project)
      : buildLid(holeContext.grid, holeContext.project);
  return burnCorrect(panel.toPiece(), holeContext.project.burnMm);
}

// Built from the REAL pipeline, folding in every notch/hole currently
// stored for this piece (buildWallPanel/buildBasePlate/buildLid all read
// project.pieceNotches/pieceHoles directly) — what you see here IS what
// gets exported, rendered exactly once regardless of which sections below
// apply to the current piece.
function renderPieceVisual(piece, holes, onHoleChange, notches, onNotchChange, wallContext) {
  const svg = pieceToStandaloneSvg(piece, { padding: 8, minSize: 380, showLabels: false });
  const pieceSpace = svg.querySelector('.piece-space');
  attachHoleDragOverlay(pieceSpace, holes, onHoleChange);
  if (wallContext) {
    const spans = heightProfile(wallContext.run, wallContext.grid, wallContext.project);
    attachNotchDragOverlay(pieceSpace, notches, spans, onNotchChange);
  }
  return el('div', { class: 'inspector-section' }, [
    el('div', { class: 'preview-card piece-visual' }, [svg]),
  ]);
}

function renderSegmentFields(project, selected, store) {
  const { kind, c, r } = selected;
  const grid = project.grid;
  const seg = kind === 'v' ? grid.vWalls[c][r] : grid.hWalls[c][r];
  const outer = isOuterSegment(grid, kind, c, r);
  const resolvedHeight = resolveHeight(seg, project);
  const resolvedThickness = resolveThickness(seg, project);

  const presenceRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: t('inspector.state') }),
    el('button', {
      class: 'btn',
      text: seg.present ? t('inspector.removeSegment') : t('inspector.addSegment'),
      disabled: outer,
      onClick: () => store.apply((p) => ({ ...p, grid: toggleWall(p.grid, kind, c, r) })),
    }),
    outer ? el('span', { class: 'hint', text: t('inspector.outerCannotRemove') }) : null,
  ]);

  // No group selector — a segment's thicknessGroup is fixed by its
  // position (outer perimeter vs. interior divider), never reassignable
  // per segment. Just show the resolved value, read-only.
  const groupRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: t('inspector.thickness') }),
    el('span', { class: 'hint', text: t('inspector.thicknessValue', { thickness: resolvedThickness, kind: outer ? t('inspector.outer') : t('inspector.inner') }) }),
  ]);

  const heightInput = el('input', {
    type: 'number',
    step: '1',
    min: '0',
    value: seg.heightMm != null ? String(seg.heightMm) : '',
    placeholder: t('inspector.heightPlaceholder', { height: resolvedHeight }),
    onChange: (evt) => {
      const raw = evt.target.value.trim();
      const heightMm = raw === '' ? null : Number(raw);
      store.apply((p) => ({ ...p, grid: setSegmentHeight(p.grid, kind, c, r, heightMm) }));
    },
  });
  const heightRow = el('div', { class: 'field' }, [
    el('span', { class: 'field-label', text: t('inspector.height') }),
    heightInput,
    outer ? el('span', { class: 'hint', text: t('inspector.heightAppliesOuter') }) : null,
  ]);

  return el('div', { class: 'inspector-section' }, [
    el('h3', { text: t('inspector.wallHeading', { kind: kindLabel(kind), c, r }) }),
    presenceRow,
    groupRow,
    heightRow,
  ]);
}

export function renderInspector(project, selected, selectedWallId, store) {
  const sections = [];

  const wallContext = selectedWallId ? resolveWallRunContext(project, selectedWallId) : null;
  const holeContext = selectedWallId ? resolvePieceHoleContext(project, selectedWallId) : null;

  if (holeContext) {
    const holes = Hole.listFor(project.pieceHoles, selectedWallId);
    const onHoleChange = (index, patch) => store.apply((p) => ({
      ...p,
      pieceHoles: { ...p.pieceHoles, [selectedWallId]: Cutout.replaceAt(Hole.listFor(p.pieceHoles, selectedWallId), index, patch) },
    }));
    const notches = wallContext ? Notch.listFor(project.pieceNotches, selectedWallId) : [];
    const onNotchChange = (index, patch) => store.apply((p) => ({
      ...p,
      pieceNotches: { ...p.pieceNotches, [selectedWallId]: Cutout.replaceAt(Notch.listFor(p.pieceNotches, selectedWallId), index, patch) },
    }));
    sections.push(renderPieceVisual(buildInspectedPiece(holeContext), holes, onHoleChange, notches, onNotchChange, wallContext));
  }
  if (selected) sections.push(renderSegmentFields(project, selected, store));
  if (wallContext) sections.push(renderGripNotchSection(project, selectedWallId, wallContext, store));
  if (holeContext) sections.push(renderHoleSection(project, selectedWallId, holeContext, store));

  if (!sections.length) {
    return el('div', { class: 'inspector empty' }, [
      el('p', { text: t('inspector.empty') }),
    ]);
  }

  return el('div', { class: 'inspector' }, sections);
}
