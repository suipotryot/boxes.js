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
import { buildWallPiece, buildBasePlate, buildLid, wallSmoothEdges } from '../geometry/oo/Assembly.js';
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
function renderPieceVisual(piece, holes, onHoleChange, notches, onNotchChange, notchContext, holeSelectedIndex, notchSelectedIndex, onSelectCutout) {
  const svg = pieceToStandaloneSvg(piece, { padding: 8, minSize: 380, showLabels: false });
  const pieceSpace = svg.querySelector('.piece-space');
  // A pointerdown that reaches the group itself (never a cutout's own rect,
  // which stops propagation) means the piece's own body or empty space was
  // clicked — clear the selection.
  pieceSpace.addEventListener('pointerdown', () => onSelectCutout(null));
  attachHoleDragOverlay(pieceSpace, holes, holeSelectedIndex, (index) => onSelectCutout({ kind: 'hole', index }), onHoleChange);
  if (notchContext) {
    attachNotchDragOverlay(pieceSpace, notches, notchContext.frame, notchSelectedIndex, (index) => onSelectCutout({ kind: 'notch', index }), onNotchChange);
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

/** Which open (smooth) compass edge of the selected piece to add a grip
 *  notch to — only shown when there's an actual choice (2+ candidates).
 *  Applies to BOTH a flat piece (base-plate/lid, PieceContext.
 *  enumerateSmoothFlatEdges — can have several independent open sides) and
 *  a wall (Assembly.wallSmoothEdges — its own free/top edge, OR an END
 *  edge with no perpendicular mate; never both at once in any reachable
 *  case today, so this never actually renders for a wall, but the same
 *  selector serves it for free if that invariant ever changes). */
function renderEdgeSelector(smoothEdges, selectedFlatEdge, onSelectFlatEdge) {
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
  // A piece is either a wall OR a flat panel, never both — wallContext and
  // holeContext.kind==='flat' are mutually exclusive (PieceContext.js's
  // own resolvers key off the identical run lookup). Which list of
  // "genuinely un-jointed edges" applies follows the same split: a wall's
  // own free/top edge is never the only option when jointed (Assembly.
  // wallSmoothEdges correctly reports NONE for a fully-enclosed wall,
  // unlike the old unconditional "always show the wall notch editor").
  const smoothEdges = wallContext
    ? wallSmoothEdges(wallContext.run, wallContext.grid, wallContext.project)
    : holeContext && holeContext.kind === 'flat'
      ? enumerateSmoothFlatEdges(holeContext.grid, holeContext.project, holeContext.rawId)
      : [];
  // A single open edge needs no picking — there's nothing to choose
  // between, so it's active automatically and the selector below stays
  // hidden. With several, the user's own explicit choice (selectedFlatEdge)
  // decides which one; stale (e.g. the project changed and that edge isn't
  // open any more) reads as "nothing active" — same bounds-guard spirit as
  // holeSelectedIndex/notchSelectedIndex below.
  const activeEdge = smoothEdges.length === 1
    ? smoothEdges[0]
    : selectedFlatEdge ? smoothEdges.find((e) => e.compass === selectedFlatEdge) : null;
  // The grip-notch context and the storage key that goes with it: a wall's
  // own free/top edge keeps the plain pieceId key and the existing
  // wall-run validation path (the historical, still overwhelmingly common
  // case, entirely unchanged); any OTHER active edge — a flat panel's open
  // side, or a wall's own END edge — is a generic length+cap edge, keyed
  // by the compound `${pieceId}:${compass}` (Assembly.js's own
  // wallSmoothEdges/flatGripFragments).
  const notchContext = activeEdge
    ? activeEdge.isFreeEdge
      ? { kind: 'wall', frame: activeEdge.frame, ...wallContext }
      : { kind: 'flat', lengthMm: activeEdge.lengthMm, capMm: activeEdge.capMm, frame: activeEdge.frame }
    : null;
  const notchPieceId = activeEdge
    ? activeEdge.isFreeEdge ? selectedWallId : `${selectedWallId}:${activeEdge.compass}`
    : null;

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
    sections.push(renderPieceVisual(buildInspectedPiece(holeContext), holes, onHoleChange, notches, onNotchChange, notchContext, holeSelectedIndex, notchSelectedIndex, onSelectCutout));
  }
  if (selected) sections.push(renderSegmentFields(project, selected, store));
  // Only shown when there's an actual choice to make — a single open edge
  // is already active on its own (see activeEdge above), so a one-option
  // selector would just be a pointless extra click.
  if (smoothEdges.length > 1) sections.push(renderEdgeSelector(smoothEdges, selectedFlatEdge, onSelectFlatEdge));
  if (notchContext) sections.push(renderGripNotchSection(project, notchPieceId, notchContext, store, notchSelectedIndex));
  if (holeContext) sections.push(renderHoleSection(project, selectedWallId, holeContext, store, holeSelectedIndex));

  if (!sections.length) {
    return el('div', { class: 'inspector empty' }, [
      el('p', { text: t('inspector.empty') }),
    ]);
  }

  return el('div', { class: 'inspector' }, sections);
}
