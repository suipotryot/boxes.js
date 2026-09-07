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
import { resolveWallRunContext, resolvePieceHoleContext, enumerateSmoothFlatEdges } from '../geometry/PieceContext.js';
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
function renderPieceVisual(piece, holes, onHoleChange, notches, onNotchChange, wallContext, holeSelectedIndex, notchSelectedIndex, onSelectCutout) {
  const svg = pieceToStandaloneSvg(piece, { padding: 8, minSize: 380, showLabels: false });
  const pieceSpace = svg.querySelector('.piece-space');
  // A pointerdown that reaches the group itself (never a cutout's own rect,
  // which stops propagation) means the piece's own body or empty space was
  // clicked — clear the selection.
  pieceSpace.addEventListener('pointerdown', () => onSelectCutout(null));
  attachHoleDragOverlay(pieceSpace, holes, holeSelectedIndex, (index) => onSelectCutout({ kind: 'hole', index }), onHoleChange);
  if (wallContext) {
    const spans = heightProfile(wallContext.run, wallContext.grid, wallContext.project);
    attachNotchDragOverlay(pieceSpace, notches, spans, notchSelectedIndex, (index) => onSelectCutout({ kind: 'notch', index }), onNotchChange);
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

const COMPASS_LABEL_KEY = { top: 'notch.edgeTop', right: 'notch.edgeRight', bottom: 'notch.edgeBottom', left: 'notch.edgeLeft' };

/** Which open (smooth) compass side of the selected flat piece (base-plate/
 *  lid) to add a grip notch to — only shown when at least one exists (see
 *  PieceContext.enumerateSmoothFlatEdges; the ordinary case, every outer
 *  wall present, shows nothing here at all). A flat piece can have several
 *  independent open edges, unlike a wall's single free/top edge, hence a
 *  dedicated selector rather than reusing the segment click the wall path
 *  relies on (a flat piece has no grid segment of its own to click either). */
function renderFlatEdgeSelector(smoothEdges, selectedFlatEdge, onSelectFlatEdge) {
  const buttons = smoothEdges.map(({ compass }) => el('button', {
    class: compass === selectedFlatEdge ? 'btn active' : 'btn',
    text: t(COMPASS_LABEL_KEY[compass]),
    onClick: () => onSelectFlatEdge(compass),
  }));
  return el('div', { class: 'inspector-section' }, [
    el('div', { class: 'field-label', text: t('notch.edgeSelectorLabel') }),
    el('div', { class: 'hint', text: t('notch.edgeSelectorHint') }),
    el('div', { class: 'button-row' }, buttons),
  ]);
}

export function renderInspector(project, selected, selectedWallId, store, selectedCutout, onSelectCutout, selectedFlatEdge, onSelectFlatEdge) {
  const sections = [];

  const wallContext = selectedWallId ? resolveWallRunContext(project, selectedWallId) : null;
  const holeContext = selectedWallId ? resolvePieceHoleContext(project, selectedWallId) : null;
  const smoothFlatEdges = holeContext && holeContext.kind === 'flat'
    ? enumerateSmoothFlatEdges(holeContext.grid, holeContext.project, holeContext.rawId)
    : [];
  // A single open edge needs no picking — there's nothing to choose
  // between, so it's active automatically and the selector below stays
  // hidden. With several, the user's own explicit choice (selectedFlatEdge)
  // decides which one; stale (e.g. the project changed and that edge isn't
  // open any more) reads as "nothing active" — same bounds-guard spirit as
  // holeSelectedIndex/notchSelectedIndex below.
  const activeFlatEdge = smoothFlatEdges.length === 1
    ? smoothFlatEdges[0]
    : selectedFlatEdge ? smoothFlatEdges.find((e) => e.compass === selectedFlatEdge) : null;
  // The grip-notch context (a wall's own free edge, OR one open flat edge)
  // and the storage key that goes with it — a flat edge's own notches are
  // keyed by the compound `${pieceId}:${compass}` (Assembly.js's own
  // flatGripFragments), since a flat piece can have several independent
  // open edges, unlike a wall's plain pieceId.
  const notchContext = wallContext
    ? { kind: 'wall', ...wallContext }
    : activeFlatEdge ? { kind: 'flat', lengthMm: activeFlatEdge.lengthMm, capMm: activeFlatEdge.capMm } : null;
  const notchPieceId = wallContext ? selectedWallId : activeFlatEdge ? `${selectedWallId}:${activeFlatEdge.compass}` : null;

  // Null (not -1) when nothing of that kind is selected, or the selection
  // is stale (e.g. the selected hole was deleted from under it) — a simple
  // bounds guard rather than tracking index shifts. Declared here (not
  // inside the `if (holeContext)` block below) since renderGripNotchSection
  // is reached through its own, separate `if (notchContext)`.
  let holeSelectedIndex = null;
  let notchSelectedIndex = null;

  if (holeContext) {
    const holes = Hole.listFor(project.pieceHoles, selectedWallId);
    const onHoleChange = (index, patch) => store.apply((p) => ({
      ...p,
      pieceHoles: { ...p.pieceHoles, [selectedWallId]: Cutout.replaceAt(Hole.listFor(p.pieceHoles, selectedWallId), index, patch) },
    }));
    const notches = notchContext ? Notch.listFor(project.pieceNotches, notchPieceId) : [];
    const onNotchChange = (index, patch) => store.apply((p) => ({
      ...p,
      pieceNotches: { ...p.pieceNotches, [notchPieceId]: Cutout.replaceAt(Notch.listFor(p.pieceNotches, notchPieceId), index, patch) },
    }));
    holeSelectedIndex = selectedCutout && selectedCutout.kind === 'hole' && selectedCutout.index < holes.length ? selectedCutout.index : null;
    notchSelectedIndex = selectedCutout && selectedCutout.kind === 'notch' && selectedCutout.index < notches.length ? selectedCutout.index : null;
    // The drag overlay stays wall-only for now (gated on wallContext, not
    // notchContext) — a flat edge's own notch still shows up correctly,
    // baked into the real piece visual, just without drag handles yet.
    sections.push(renderPieceVisual(buildInspectedPiece(holeContext), holes, onHoleChange, notches, onNotchChange, wallContext, holeSelectedIndex, notchSelectedIndex, onSelectCutout));
  }
  if (selected) sections.push(renderSegmentFields(project, selected, store));
  // Only shown when there's an actual choice to make — a single open edge
  // is already active on its own (see activeFlatEdge above), so a
  // one-option selector would just be a pointless extra click.
  if (smoothFlatEdges.length > 1) sections.push(renderFlatEdgeSelector(smoothFlatEdges, selectedFlatEdge, onSelectFlatEdge));
  if (notchContext) sections.push(renderGripNotchSection(project, notchPieceId, notchContext, store, notchSelectedIndex));
  if (holeContext) sections.push(renderHoleSection(project, selectedWallId, holeContext, store, holeSelectedIndex));

  if (!sections.length) {
    return el('div', { class: 'inspector empty' }, [
      el('p', { text: t('inspector.empty') }),
    ]);
  }

  return el('div', { class: 'inspector' }, sections);
}
