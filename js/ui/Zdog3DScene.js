// The one file that imports Zdog directly — converts computePieces()
// output into Zdog.Shape primitives inside one Illustration, via
// PiecePlacement3D (world placement) and PanelExtrude3D (local
// front/back/side face data). No Zdog Anchor rotation is used anywhere:
// every point is already computed in world space before it ever reaches
// Zdog, sidestepping any need to verify Zdog's own Euler-rotation
// composition order (see the plan).
import Zdog from 'zdog';
import { computePieces } from '../geometry/PieceFactory.js';
import { computePiecePlacement3D, toWorld } from '../geometry/PiecePlacement3D.js';
import { extrudeOutline3D } from '../geometry/PanelExtrude3D.js';
import { DRAWER_PREFIX } from '../geometry/DrawerBuilder.js';

// v1 scope (see the plan): the base plate, every wall run, and the lid —
// PiecePlacement3D only knows how to place these three kinds. Drawer
// pieces stay out of the 3D view entirely: the sleeve's own world offset
// relative to the main box (surrounding it with playMm clearance, open on
// one side) doesn't exist anywhere in the pipeline yet, and every drawer
// piece id carries DRAWER_PREFIX regardless of its own kind, so it's
// filtered on id rather than kind.
const SUPPORTED_KINDS = new Set(['basePlate', 'lid', 'wall']);

function pieceColor(piece) {
  const varName = piece.thicknessGroup === 'outer' ? '--outer' : '--inner';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Zdog has no per-face lighting — every Shape is one flat, unshaded color
// (its `stroke` is an outline WIDTH, not a separate outline color; a
// distinct outline would mean twice the shapes). Without any differentiation
// between a piece's top/bottom faces and its own side rim, an assembled box
// reads as one undifferentiated blob (confirmed: this was genuinely
// unreadable before this existed, not just a cosmetic nicety) — darkening
// side faces fakes just enough directional shading to read as a solid.
const SIDE_DARKEN = 0.25;

function darken(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 0xff) * (1 - amount);
  const g = ((n >> 8) & 0xff) * (1 - amount);
  const b = (n & 0xff) * (1 - amount);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

function addFace(illustration, worldPoints, color) {
  new Zdog.Shape({ addTo: illustration, path: worldPoints, fill: true, color, stroke: 1 });
}

/** Clears and repopulates `illustration` with one Zdog.Shape per face
 *  (front/back/side) of every eligible piece of computePieces(project). */
export function populateScene(illustration, project) {
  illustration.children.slice().forEach((child) => child.remove());

  const pieces = computePieces(project)
    .filter((p) => SUPPORTED_KINDS.has(p.kind) && !p.id.startsWith(DRAWER_PREFIX));
  for (const piece of pieces) {
    const placement = computePiecePlacement3D(project.grid, project, piece);
    const local = extrudeOutline3D(piece.outline, piece.thicknessMm);
    const color = pieceColor(piece);
    const sideColor = darken(color, SIDE_DARKEN);
    addFace(illustration, local.front.map((p) => toWorld(placement, p)), color);
    addFace(illustration, local.back.map((p) => toWorld(placement, p)), color);
    for (const quad of local.sides) addFace(illustration, quad.map((p) => toWorld(placement, p)), sideColor);
  }
}
