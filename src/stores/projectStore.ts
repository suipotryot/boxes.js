import { defineStore } from 'pinia';

import { ColorHeightRegistry } from '@/domain/models/ColorHeightRegistry';
import type { LineNeighborRef } from '@/domain/models/Grid';
import type { Notch } from '@/domain/models/Notch';
import type { Panel } from '@/domain/models/Panel';
import type { Project, ProjectConfig } from '@/domain/models/Project';
import type { ShelfConfig } from '@/domain/models/Shelf';
import type { Axis, Rect } from '@/domain/models/types';
import type { WallSegment } from '@/domain/models/WallSegment';
import {
  addLine,
  addSegmentNotch,
  canAddLine,
  canMoveLineTo,
  moveLine,
  removeLine,
  removeSegmentNotch,
  setSegmentColor,
  setSegmentRemoved,
} from '@/domain/services/GridDivider';
import { canSetColorHeight, canSetShelfHeight } from '@/domain/services/HeightConstraints';
import { createNewProject, type NewProjectInput } from '@/domain/services/ProjectFactory';
import { generatePanels, resolveInnerRect } from '@/domain/services/ProjectGenerator';
import { extract } from '@/domain/services/WallExtractor';
import { HistoryManager } from '@/storage/HistoryManager';

// One history instance for the app's single active project; not part of
// Pinia's reactive state (JSON-string snapshots don't need to be reactive).
// `historyVersion` in state exists purely so canUndo/canRedo getters have a
// reactive dependency to key off.
const history = new HistoryManager<Project>();

export const useProjectStore = defineStore('project', {
  state: () => ({
    project: null as Project | null,
    historyVersion: 0,
  }),
  getters: {
    generatedPanels(state): Panel[] {
      return state.project ? generatePanels(state.project) : [];
    },
    innerRect(state): Rect | null {
      return state.project ? resolveInnerRect(state.project.config) : null;
    },
    canUndo(state): boolean {
      void state.historyVersion;
      return history.canUndo();
    },
    canRedo(state): boolean {
      void state.historyVersion;
      return history.canRedo();
    },
    /** Raw wall segments (plan-view positions), for the 2D canvas -- distinct
     * from generatedPanels, whose outlines are unrolled elevations meant for
     * 3D placement and SVG export, not top-down rendering. */
    generatedWalls(state): WallSegment[] {
      if (!state.project) return [];
      const colors = new ColorHeightRegistry(state.project.colors);
      const innerRect = resolveInnerRect(state.project.config);
      return extract({
        grid: state.project.grid,
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
      history.clear();
      this.historyVersion++;
    },
    loadProject(project: Project) {
      this.project = project;
      history.clear();
      this.historyVersion++;
    },
    /** Snapshots the current project onto the undo stack before a mutation. Call at the start of every mutating action, after any validation has already passed. */
    pushHistory() {
      if (!this.project) return;
      history.push(this.project);
      this.historyVersion++;
    },
    undo() {
      if (!this.project) return;
      const previous = history.undo(this.project);
      if (previous) {
        this.project = previous;
      }
      this.historyVersion++;
    },
    redo() {
      if (!this.project) return;
      const next = history.redo(this.project);
      if (next) {
        this.project = next;
      }
      this.historyVersion++;
    },
    /** Returns false (no-op) if the position is too close to a box edge or
     * to an existing line of the same axis. */
    addLine(axis: Axis, positionMm: number, colorId: string): boolean {
      if (!this.project) return false;
      const innerRect = resolveInnerRect(this.project.config);
      if (!canAddLine(this.project.grid.lines, axis, positionMm, innerRect)) return false;
      this.pushHistory();
      this.project.grid = addLine(this.project.grid, axis, positionMm, colorId, innerRect);
      return true;
    },
    /** Returns false (no-op) if the new position would cross a same-axis neighbour. */
    moveLine(lineId: string, positionMm: number): boolean {
      if (!this.project) return false;
      const innerRect = resolveInnerRect(this.project.config);
      if (!canMoveLineTo(this.project.grid.lines, lineId, positionMm, innerRect)) return false;
      this.pushHistory();
      this.project.grid = moveLine(this.project.grid, lineId, positionMm);
      return true;
    },
    removeLine(lineId: string) {
      if (!this.project) return;
      const innerRect = resolveInnerRect(this.project.config);
      this.pushHistory();
      this.project.grid = removeLine(this.project.grid, lineId, innerRect);
    },
    updateLineColor(lineId: string, colorId: string) {
      if (!this.project) return;
      const line = this.project.grid.lines.find((l) => l.id === lineId);
      if (line) {
        this.pushHistory();
        line.colorId = colorId;
      }
    },
    /** Segment-level actions: ready for use as soon as a segment-editing UI
     * exists, not yet wired to any dialog/renderer in this pass. */
    setSegmentRemoved(lineId: string, start: LineNeighborRef, end: LineNeighborRef, removed: boolean) {
      if (!this.project) return;
      this.pushHistory();
      this.project.grid = setSegmentRemoved(this.project.grid, lineId, start, end, removed);
    },
    setSegmentColor(lineId: string, start: LineNeighborRef, end: LineNeighborRef, colorId: string | null) {
      if (!this.project) return;
      this.pushHistory();
      this.project.grid = setSegmentColor(this.project.grid, lineId, start, end, colorId);
    },
    /** Returns false (no-op) if the new height would push a divider above an active shelf. */
    updateColorHeight(colorId: string, heightMm: number): boolean {
      if (!this.project) return false;
      if (!canSetColorHeight(this.project, colorId, heightMm)) return false;
      const entry = this.project.colors.find((c) => c.id === colorId);
      if (!entry) return false;
      this.pushHistory();
      entry.heightMm = heightMm;
      return true;
    },
    updateColorHex(colorId: string, hex: string) {
      if (!this.project) return;
      const entry = this.project.colors.find((c) => c.id === colorId);
      if (entry) {
        this.pushHistory();
        entry.color = hex;
      }
    },
    /** Resolves a hex color to an existing entry or creates a new one at baseWallHeightMm.
     * Deliberately does not push its own history entry -- it's always a
     * sub-step of a larger action (split, recolor) that already pushes one;
     * pushing here too would split one user-facing action into two undo steps. */
    findOrCreateColor(hex: string): string {
      if (!this.project) throw new Error('No project loaded');
      const registry = new ColorHeightRegistry(this.project.colors);
      const entry = registry.findOrCreateByColor(hex, this.project.config.baseWallHeightMm);
      this.project.colors = registry.entries;
      return entry.id;
    },
    updateConfig(patch: Partial<ProjectConfig>) {
      if (!this.project) return;
      this.pushHistory();
      Object.assign(this.project.config, patch);
    },
    /** Returns false (no-op) if the height would sit below an existing divider. */
    setShelf(shelf: ShelfConfig | null): boolean {
      if (!this.project) return false;
      if (shelf && !canSetShelfHeight(this.project, shelf.heightMm)) return false;
      this.pushHistory();
      this.project.config.shelf = shelf;
      return true;
    },
    addNotch(lineId: string, start: LineNeighborRef, end: LineNeighborRef, notch: Notch) {
      if (!this.project) return;
      this.pushHistory();
      this.project.grid = addSegmentNotch(this.project.grid, lineId, start, end, notch);
    },
    removeNotch(lineId: string, start: LineNeighborRef, end: LineNeighborRef, notchId: string) {
      if (!this.project) return;
      this.pushHistory();
      this.project.grid = removeSegmentNotch(this.project.grid, lineId, start, end, notchId);
    },
  },
});
