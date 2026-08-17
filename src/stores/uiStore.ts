import { defineStore } from 'pinia';

import type { Axis } from '@/domain/models/types';

export type ActiveDialog =
  | { kind: 'newProject' }
  | { kind: 'addLine'; axis: Axis; positionMm: number }
  | { kind: 'edgeEdit'; wallId: string }
  | { kind: 'advancedOptions' }
  | { kind: 'recentProjects' }
  | { kind: 'confirm'; message: string; onConfirm: () => void }
  | null;

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface UiState {
  selectedEdgeId: string | null;
  /** Non-null while the user has armed "add a line" mode from the sidebar
   * -- the canvas then shows a ghost line following the cursor on this
   * axis, and a click places it (opening AddLineDialog to confirm). */
  linePlacementAxis: Axis | null;
  activeDialog: ActiveDialog;
  /** Hides the intermediate shelf/lid in the 3D view so the dividers
   * underneath stay visible -- see the plan's shelf-visibility decision. */
  shelfVisible: boolean;
  showDimensions: boolean;
  viewport: Viewport;
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    selectedEdgeId: null,
    linePlacementAxis: null,
    activeDialog: null,
    shelfVisible: true,
    showDimensions: false,
    viewport: { scale: 1, offsetX: 0, offsetY: 0 },
  }),
  actions: {
    openDialog(dialog: ActiveDialog) {
      this.activeDialog = dialog;
    },
    closeDialog() {
      this.activeDialog = null;
    },
    selectEdge(wallId: string | null) {
      this.selectedEdgeId = wallId;
    },
    clearSelection() {
      this.selectedEdgeId = null;
    },
    /** Arms line-placement mode for `axis`, or disarms it if that axis is
     * already armed (toggle, so the same sidebar button both starts and
     * cancels placement). */
    setLinePlacementAxis(axis: Axis | null) {
      this.linePlacementAxis = this.linePlacementAxis === axis ? null : axis;
    },
    setViewport(viewport: Viewport) {
      this.viewport = viewport;
    },
    toggleShelfVisible() {
      this.shelfVisible = !this.shelfVisible;
    },
    toggleDimensions() {
      this.showDimensions = !this.showDimensions;
    },
  },
});
