import { ColorHeightRegistry } from '../models/ColorHeightRegistry';
import type { Panel } from '../models/Panel';
import type { Project, ProjectConfig } from '../models/Project';
import type { Rect } from '../models/types';
import { buildBasePlate } from './BasePlateBuilder';
import { classifyJunctions } from './JunctionClassifier';
import { buildWallPanel } from './PanelBuilder';
import { buildShelf } from './ShelfBuilder';
import { extract } from './WallExtractor';

/**
 * Orchestrates the full pipeline from project state to the flat list of
 * panels consumed by the 2D canvas, the 3D view, and SVG export alike:
 * resolve the inner cavity rect -> flatten the zone tree into walls ->
 * classify their junctions -> build every wall panel, the base plate, and
 * the shelf. Meant to be called once per project mutation (e.g. behind a
 * Pinia computed), not independently by each consumer.
 */
export function generatePanels(project: Project): Panel[] {
  const colors = new ColorHeightRegistry(project.colors);
  const innerRect = resolveInnerRect(project.config);

  const walls = extract({
    zoneTree: project.zoneTree,
    innerRect,
    outerThickness: project.config.outerThickness,
    innerThickness: project.config.innerThickness,
    outerColorId: project.config.outerColorId,
    colors,
  });

  const junctions = classifyJunctions(walls);
  const wallPanels = walls.map((wall) => buildWallPanel(wall, walls, junctions, project.config));

  const basePlate = buildBasePlate(
    walls,
    innerRect,
    project.config.outerThickness,
    project.config.advanced.fingerJoint,
    project.config.hasBottom,
  );

  const outerWalls = walls.filter((w) => w.isOuter);
  const shelfResult = buildShelf(outerWalls, innerRect, project.config);

  return [
    ...wallPanels,
    ...(basePlate ? [basePlate] : []),
    ...(shelfResult ? [shelfResult.shelf, ...shelfResult.cleats] : []),
  ];
}

/** The box's outer envelope always starts at (0,0); the inner cavity is
 * inset by outerThickness on every side. */
export function resolveInnerRect(config: ProjectConfig): Rect {
  const innerWidth = config.dimX.mode === 'inner' ? config.dimX.value : config.dimX.value - 2 * config.outerThickness;
  const innerHeight = config.dimY.mode === 'inner' ? config.dimY.value : config.dimY.value - 2 * config.outerThickness;
  return { x: config.outerThickness, y: config.outerThickness, width: innerWidth, height: innerHeight };
}
