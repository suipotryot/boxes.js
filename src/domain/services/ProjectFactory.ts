import type { ColorEntry } from '../models/ColorHeightRegistry';
import type { DimensionSpec, Project, ProjectConfig } from '../models/Project';
import { createId } from './GeometryUtils';

export interface NewProjectInput {
  name: string;
  outerThickness: number;
  innerThickness: number;
  baseWallHeightMm: number;
  dimX: DimensionSpec;
  dimY: DimensionSpec;
  hasBottom: boolean;
}

const DEFAULT_OUTER_COLOR = '#a67c52';

/**
 * Creates a fresh project from the "new project" dialog's inputs: the
 * outer-wall color/height is no longer a dedicated field (per the plan's
 * corrected design) -- instead this auto-creates the first color entry
 * ("Bords") from baseWallHeightMm and assigns it as outerColorId, editable
 * afterwards through the color legend like any divider color. The zone
 * tree starts as a single leaf (an empty box, no splits yet).
 */
export function createNewProject(input: NewProjectInput): Project {
  const outerColor: ColorEntry = {
    id: createId('color'),
    color: DEFAULT_OUTER_COLOR,
    heightMm: input.baseWallHeightMm,
    label: 'Bords',
  };

  const config: ProjectConfig = {
    outerThickness: input.outerThickness,
    innerThickness: input.innerThickness,
    outerColorId: outerColor.id,
    baseWallHeightMm: input.baseWallHeightMm,
    dimX: input.dimX,
    dimY: input.dimY,
    hasBottom: input.hasBottom,
    shelf: null,
    advanced: {
      laserBedX: 300,
      laserBedY: 200,
      burnMm: 0.1,
      innerCornerStyle: 'corner',
      partSpacingMm: 2,
      fingerJoint: {
        style: 'rectangular',
        fingerMm: 10,
        spaceMm: 10,
        widthMm: input.innerThickness,
        edgeWidthMm: Math.max(input.outerThickness, input.innerThickness),
        playMm: 0,
        extraLengthMm: 0,
        surroundingSpaces: 0,
      },
    },
  };

  return {
    id: createId('project'),
    name: input.name,
    config,
    colors: [outerColor],
    zoneTree: { kind: 'leaf', id: createId('zone') },
  };
}
