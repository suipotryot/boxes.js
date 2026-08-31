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

// v1 scope: only the base plate for now — walls/lid are added in a
// follow-up step (see the plan's PR breakdown). Drawer pieces stay out of
// the 3D view entirely (no world-offset for the sleeve exists anywhere in
// the pipeline yet).
const SUPPORTED_KINDS = new Set(['basePlate']);

function pieceColor(piece) {
  const varName = piece.thicknessGroup === 'outer' ? '--outer' : '--inner';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function addFace(illustration, worldPoints, color) {
  new Zdog.Shape({ addTo: illustration, path: worldPoints, fill: true, color, stroke: 1 });
}

/** Clears and repopulates `illustration` with one Zdog.Shape per face
 *  (front/back/side) of every eligible piece of computePieces(project). */
export function populateScene(illustration, project) {
  illustration.children.slice().forEach((child) => child.remove());

  const pieces = computePieces(project).filter((p) => SUPPORTED_KINDS.has(p.kind));
  for (const piece of pieces) {
    const placement = computePiecePlacement3D(project.grid, project, piece);
    const local = extrudeOutline3D(piece.outline, piece.thicknessMm);
    const color = pieceColor(piece);
    addFace(illustration, local.front.map((p) => toWorld(placement, p)), color);
    addFace(illustration, local.back.map((p) => toWorld(placement, p)), color);
    for (const quad of local.sides) addFace(illustration, quad.map((p) => toWorld(placement, p)), color);
  }
}
