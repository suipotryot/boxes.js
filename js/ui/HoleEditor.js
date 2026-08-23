// The "trous" (holes) editor — shown in the same sidebar as
// SegmentInspector's segment/grip-notch fields, for whichever piece is
// currently selected (SegmentInspector.js resolves it via
// PieceContext.resolvePieceHoleContext, which — unlike the grip-notch
// resolver — also covers the base plate/lid and their drawer equivalents,
// since a hole is never anchored to an edge the way a grip notch is: both
// x and y are entirely free, so it applies to any flat piece). A piece can
// have SEVERAL holes, stored as a list (project.pieceHoles[pieceId],
// Hole.holeListFor) — same list-of-removable-items UI as GripNotchEditor.js,
// down to the shared trashIcon() and the one-line-per-item CSV field
// (deliberately compact and copy/paste-able to duplicate a hole).
import { el } from './dom.js';
import { infoIcon, trashIcon } from './fields.js';
import { DEFAULT_HOLE, maxRadiusMm, holeListFor, formatHoleLine, parseHoleLine } from '../geometry/Hole.js';
import { validateHoleInRect, validateWallHole } from '../geometry/HoleValidation.js';
import { buildWallPanel } from '../geometry/PanelBuilder.js';
import { buildBasePlate } from '../geometry/BasePlateBuilder.js';
import { buildLid } from '../geometry/LidBuilder.js';
import { DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';
import { burnCorrect } from '../geometry/BurnCorrection.js';
import { pieceToStandaloneSvg, pieceLabel } from '../geometry/SvgPath.js';

function rebuildPiece(context) {
  if (context.kind === 'wall') return buildWallPanel(context.run, context.grid, context.project, true);
  return context.rawId === 'base-plate' ? buildBasePlate(context.grid, context.project) : buildLid(context.grid, context.project);
}

function validateHole(context, hole, siblings) {
  return context.kind === 'wall'
    ? validateWallHole(context.run, context.grid, context.project, hole, siblings)
    : validateHoleInRect(context.widthMm, context.heightMm, hole, siblings);
}

function pieceHeading(pieceId, context, piece) {
  const label = pieceLabel(piece);
  if (label) return label;
  const base = context.rawId === 'base-plate' ? 'Plaque de fond' : 'Couvercle';
  return pieceId.startsWith(DRAWER_PREFIX) ? `Tiroir — ${base}` : base;
}

function renderOneHole(index, hole, siblings, context, onUpdate, onRemove) {
  const header = el('div', { class: 'hole-header' }, [
    el('span', { class: 'field-label' }, [`Trou ${index + 1}`, infoIcon(
      'Position X, position Y, dimension X, dimension Y, arrondi des angles (mm) : les 5 valeurs de ce trou, séparées par des virgules, dans cet ordre. Le point (pas la virgule) sépare les décimales — ex. « 20, 10, 30, 15, 3 ». Le trou doit rester à au moins 2mm de chaque bord de la pièce (dents non comprises), et ne doit chevaucher aucun autre trou.',
    )]),
    el('button', {
      class: 'icon-btn', title: 'Supprimer ce trou', 'aria-label': 'Supprimer ce trou',
      onClick: onRemove,
    }, [trashIcon()]),
  ]);

  const lineField = el('label', { class: 'field' }, [
    el('input', {
      type: 'text', value: formatHoleLine(hole),
      onChange: (evt) => {
        const parsed = parseHoleLine(evt.target.value);
        if (!parsed) { evt.target.classList.add('invalid-input'); return; } // texte illisible : ni perdu, ni appliqué tel quel
        evt.target.classList.remove('invalid-input');
        onUpdate(parsed);
      },
    }),
  ]);

  const validation = validateHole(context, hole, siblings);
  const warning = !validation.ok ? el('div', { class: 'field' }, [
    ...validation.problems.map((msg) => el('span', { class: 'warning', text: msg })),
    el('button', {
      class: 'btn', text: 'Ajuster automatiquement',
      onClick: () => {
        const widthMm = Math.max(1, Math.min(hole.widthMm, validation.maxWidthMm));
        const heightMm = Math.max(1, Math.min(hole.heightMm, validation.maxHeightMm));
        const refit = validateHole(context, { ...hole, widthMm, heightMm }, siblings);
        const xMm = Math.min(Math.max(hole.xMm, refit.minXMm), refit.maxXMm);
        const yMm = Math.min(Math.max(hole.yMm, refit.minYMm), refit.maxYMm);
        const radiusMm = Math.min(hole.radiusMm, maxRadiusMm({ widthMm, heightMm }));
        onUpdate({ xMm, yMm, widthMm, heightMm, radiusMm });
      },
    }),
  ]) : null;

  return el('div', { class: 'hole-item' }, [header, lineField, warning]);
}

export function renderHoleSection(project, pieceId, context, store) {
  const holes = holeListFor(project.pieceHoles, pieceId);

  const setList = (nextList) => store.apply((p) => ({
    ...p,
    pieceHoles: { ...p.pieceHoles, [pieceId]: nextList },
  }));
  const updateAt = (index, patch) => setList(holeListFor(project.pieceHoles, pieceId).map((h, i) => (i === index ? { ...h, ...patch } : h)));
  const removeAt = (index) => setList(holeListFor(project.pieceHoles, pieceId).filter((_, i) => i !== index));
  const addHole = () => setList([...holes, { ...DEFAULT_HOLE }]);

  // Built from the REAL pipeline (rebuildPiece, burn-corrected), folding in
  // every hole currently in the list — what you see here IS what gets
  // exported, same principle as GripNotchEditor's own preview.
  const piece = burnCorrect(rebuildPiece(context), context.project.burnMm);
  const heading = el('h3', { text: pieceHeading(pieceId, context, piece) });

  const sectionLabel = el('div', { class: 'field-label' }, [
    'Trous',
    infoIcon('Découpe un ou plusieurs trous rectangulaires (avec coins arrondis en option) dans cette pièce, par exemple pour un passage de câble ou une fixation.'),
  ]);

  const items = holes.map((hole, index) => {
    const siblings = holes.filter((_, i) => i !== index);
    return renderOneHole(index, hole, siblings, context, (patch) => updateAt(index, patch), () => removeAt(index));
  });

  const addBtn = el('button', { class: 'btn', text: '+ Ajouter un trou', onClick: addHole });

  const visual = el('div', { class: 'preview-card hole-visual' }, [
    pieceToStandaloneSvg(piece, { padding: 8, minSize: 260, showLabels: false }),
  ]);

  return el('div', { class: 'inspector-section' }, [heading, sectionLabel, ...items, addBtn, visual]);
}
