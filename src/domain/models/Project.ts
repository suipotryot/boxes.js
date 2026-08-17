import type { ColorEntry } from './ColorHeightRegistry';
import type { DividerGrid } from './Grid';
import type { ShelfConfig } from './Shelf';

export interface DimensionSpec {
  value: number;
  mode: 'inner' | 'outer';
}

export interface FingerJointSettings {
  style: 'rectangular';
  spaceMm: number;
  fingerMm: number;
  widthMm: number;
  edgeWidthMm: number;
  playMm: number;
  extraLengthMm: number;
  surroundingSpaces: number;
}

export type InnerCornerStyle = 'loop' | 'corner' | 'backarc';

export interface AdvancedOptions {
  laserBedX: number;
  laserBedY: number;
  burnMm: number;
  innerCornerStyle: InnerCornerStyle;
  partSpacingMm: number;
  fingerJoint: FingerJointSettings;
}

export interface ProjectConfig {
  outerThickness: number;
  innerThickness: number;
  /** Color of the outer walls, resolved through ColorHeightRegistry like any divider. */
  outerColorId: string;
  /** Default height assigned to a newly created divider color. */
  baseWallHeightMm: number;
  dimX: DimensionSpec;
  dimY: DimensionSpec;
  hasBottom: boolean;
  shelf: ShelfConfig | null;
  advanced: AdvancedOptions;
}

export interface Project {
  id: string;
  name: string;
  config: ProjectConfig;
  colors: ColorEntry[];
  grid: DividerGrid;
}
