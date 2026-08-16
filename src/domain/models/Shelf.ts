export type ShelfMode = 'fixed' | 'removable';

/** The "couvercle" -- really an intermediate-height plate/divider. */
export interface ShelfConfig {
  /** Z position measured from the bottom. */
  heightMm: number;
  mode: ShelfMode;
}
