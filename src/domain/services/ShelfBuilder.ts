import type { ProjectConfig } from '../models/Project';
import type { Panel } from '../models/Panel';
import type { Rect } from '../models/types';
import type { WallSegment } from '../models/WallSegment';
import { createId } from './GeometryUtils';
import { wallLength } from './PanelBuilder';

export interface ShelfResult {
  shelf: Panel;
  cleats: Panel[];
}

/**
 * The "couvercle": an intermediate-height plate. Reuses BasePlateBuilder's
 * corner-notched rectangle shape (per the plan, "the same plate shape"),
 * sized to the inner footprint since it sits inside the cavity rather than
 * spanning the outer envelope. In `fixed` mode it seats into the finger-hole
 * rows PanelBuilder already cuts into each outer wall's face at heightMm --
 * this build gives the shelf panel that footprint but doesn't yet zigzag its
 * own perimeter into matching tabs (a lower-fidelity placeholder to revisit;
 * the outer walls' holes are the load-bearing correctness piece). In
 * `removable` mode it has no assembly cuts at all and instead gets simple
 * glued cleats, one per outer wall, for it to rest on.
 */
export function buildShelf(outerWalls: WallSegment[], innerRect: Rect, config: ProjectConfig): ShelfResult | null {
  if (!config.shelf) {
    return null;
  }

  const outline = rectangleWithCornerNotches(innerRect, config.outerThickness);
  const shelf: Panel = {
    id: createId('panel'),
    kind: 'shelf',
    materialThickness: config.outerThickness,
    outline,
    holes: [],
    placement3d: { origin: { x: 0, y: 0, z: config.shelf.heightMm }, rotationZ: 0 },
    sourceIds: outerWalls.map((w) => w.id),
  };

  const cleats = config.shelf.mode === 'removable' ? buildCleats(outerWalls, config) : [];
  return { shelf, cleats };
}

const CLEAT_LENGTH_MM = 30;
const CLEAT_WIDTH_MM = 10;

function buildCleats(outerWalls: WallSegment[], config: ProjectConfig): Panel[] {
  return outerWalls.map((wall) => {
    const length = Math.min(CLEAT_LENGTH_MM, wallLength(wall) * 0.6);
    const outline = [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: CLEAT_WIDTH_MM },
      { x: 0, y: CLEAT_WIDTH_MM },
    ];
    return {
      id: createId('panel'),
      kind: 'shelfCleat' as const,
      materialThickness: config.innerThickness,
      outline,
      holes: [],
      placement3d: {
        origin: { x: wall.a.x, y: wall.a.y, z: config.shelf!.heightMm },
        rotationZ: Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x),
      },
      sourceIds: [wall.id],
    };
  });
}

function rectangleWithCornerNotches(rect: Rect, notchSize: number) {
  const { x, y, width, height } = rect;
  const n = Math.min(notchSize, width / 2, height / 2);
  return [
    { x: x, y: y + n },
    { x: x + n, y: y + n },
    { x: x + n, y: y },
    { x: x + width - n, y: y },
    { x: x + width - n, y: y + n },
    { x: x + width, y: y + n },
    { x: x + width, y: y + height - n },
    { x: x + width - n, y: y + height - n },
    { x: x + width - n, y: y + height },
    { x: x + n, y: y + height },
    { x: x + n, y: y + height - n },
    { x: x, y: y + height - n },
  ];
}
