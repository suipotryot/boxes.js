// centerHolesOnX/Y, distributeHolesOnX/Y — the 4 group alignment buttons in
// HoleEditor.js. Thin Hole-specific bindings (xMm/yMm/widthMm/heightMm)
// over the shared axis math in CutoutAlignment.js — see that file for the
// actual centering/distribution algorithm, also used by NotchAlignment.js.
import { centerOnAxis, distributeOnAxis } from './CutoutAlignment.js';

const xStart = (h) => h.xMm;
const xSize = (h) => h.widthMm;
const setX = (h, xMm) => h.withChanges({ xMm });

const yStart = (h) => h.yMm;
const ySize = (h) => h.heightMm;
const setY = (h, yMm) => h.withChanges({ yMm });

export function centerHolesOnX(holes, availableWidthMm) {
  return centerOnAxis(holes, availableWidthMm, xSize, setX);
}

export function centerHolesOnY(holes, availableHeightMm) {
  return centerOnAxis(holes, availableHeightMm, ySize, setY);
}

export function distributeHolesOnX(holes) {
  return distributeOnAxis(holes, xStart, xSize, setX);
}

export function distributeHolesOnY(holes) {
  return distributeOnAxis(holes, yStart, ySize, setY);
}
