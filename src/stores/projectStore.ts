import { defineStore } from 'pinia';

import { ColorHeightRegistry } from '@/domain/models/ColorHeightRegistry';
import type { Notch } from '@/domain/models/Notch';
import type { Panel } from '@/domain/models/Panel';
import type { Project, ProjectConfig } from '@/domain/models/Project';
import type { ShelfConfig } from '@/domain/models/Shelf';
import type { Axis, Rect } from '@/domain/models/types';
import type { WallSegment } from '@/domain/models/WallSegment';
import type { ZoneNode, ZoneSplit } from '@/domain/models/Zone';
import { canSetColorHeight, canSetShelfHeight } from '@/domain/services/HeightConstraints';
import { createNewProject, type NewProjectInput } from '@/domain/services/ProjectFactory';
import { generatePanels, resolveInnerRect } from '@/domain/services/ProjectGenerator';
import { mergeZone, splitZone } from '@/domain/services/ZoneTree';
import { extract } from '@/domain/services/WallExtractor';

export const useProjectStore = defineStore('project', {
  state: () => ({
    project: null as Project | null,
  }),
  getters: {
    generatedPanels(state): Panel[] {
      return state.project ? generatePanels(state.project) : [];
    },
    innerRect(state): Rect | null {
      return state.project ? resolveInnerRect(state.project.config) : null;
    },
    /** Raw wall segments (plan-view positions), for the 2D canvas -- distinct
     * from generatedPanels, whose outlines are unrolled elevations meant for
     * 3D placement and SVG export, not top-down rendering. */
    generatedWalls(state): WallSegment[] {
      if (!state.project) return [];
      const colors = new ColorHeightRegistry(state.project.colors);
      const innerRect = resolveInnerRect(state.project.config);
      return extract({
        zoneTree: state.project.zoneTree,
        innerRect,
        outerThickness: state.project.config.outerThickness,
        innerThickness: state.project.config.innerThickness,
        outerColorId: state.project.config.outerColorId,
        colors,
      });
    },
  },
  actions: {
    createProject(input: NewProjectInput) {
      this.project = createNewProject(input);
    },
    loadProject(project: Project) {
      this.project = project;
    },
    splitZone(zoneId: string, axis: Axis, firstSize: number, dividerColorId: string) {
      if (!this.project) return;
      this.project.zoneTree = splitZone(this.project.zoneTree, zoneId, axis, firstSize, dividerColorId);
    },
    mergeZone(splitId: string) {
      if (!this.project) return;
      this.project.zoneTree = mergeZone(this.project.zoneTree, splitId);
    },
    /** Returns false (no-op) if the new height would push a divider above an active shelf. */
    updateColorHeight(colorId: string, heightMm: number): boolean {
      if (!this.project) return false;
      if (!canSetColorHeight(this.project, colorId, heightMm)) return false;
      const entry = this.project.colors.find((c) => c.id === colorId);
      if (!entry) return false;
      entry.heightMm = heightMm;
      return true;
    },
    updateColorHex(colorId: string, hex: string) {
      if (!this.project) return;
      const entry = this.project.colors.find((c) => c.id === colorId);
      if (entry) entry.color = hex;
    },
    updateDividerColor(splitId: string, colorId: string) {
      if (!this.project) return;
      const split = findSplit(this.project.zoneTree, splitId);
      if (split) split.dividerColorId = colorId;
    },
    /** Resolves a hex color to an existing entry or creates a new one at baseWallHeightMm. */
    findOrCreateColor(hex: string): string {
      if (!this.project) throw new Error('No project loaded');
      const registry = new ColorHeightRegistry(this.project.colors);
      const entry = registry.findOrCreateByColor(hex, this.project.config.baseWallHeightMm);
      this.project.colors = registry.entries;
      return entry.id;
    },
    updateConfig(patch: Partial<ProjectConfig>) {
      if (!this.project) return;
      Object.assign(this.project.config, patch);
    },
    /** Returns false (no-op) if the height would sit below an existing divider. */
    setShelf(shelf: ShelfConfig | null): boolean {
      if (!this.project) return false;
      if (shelf && !canSetShelfHeight(this.project, shelf.heightMm)) return false;
      this.project.config.shelf = shelf;
      return true;
    },
    addNotch(splitId: string, notch: Notch) {
      if (!this.project) return;
      const split = findSplit(this.project.zoneTree, splitId);
      split?.notches.push(notch);
    },
    removeNotch(splitId: string, notchId: string) {
      if (!this.project) return;
      const split = findSplit(this.project.zoneTree, splitId);
      if (split) {
        split.notches = split.notches.filter((n) => n.id !== notchId);
      }
    },
  },
});

function findSplit(tree: ZoneNode, id: string): ZoneSplit | null {
  if (tree.kind === 'leaf') return null;
  if (tree.id === id) return tree;
  return findSplit(tree.first, id) ?? findSplit(tree.second, id);
}
