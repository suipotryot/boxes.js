import { defineStore } from 'pinia';

export type ActiveDialog =
  | { kind: 'newProject' }
  | { kind: 'splitZone'; zoneId: string }
  | { kind: 'edgeEdit'; wallId: string }
  | { kind: 'recentProjects' }
  | { kind: 'confirm'; message: string; onConfirm: () => void }
  | null;

export interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface UiState {
  selectedZoneId: string | null;
  selectedEdgeId: string | null;
  activeDialog: ActiveDialog;
  /** Hides the intermediate shelf/lid in the 3D view so the dividers
   * underneath stay visible -- see the plan's shelf-visibility decision. */
  shelfVisible: boolean;
  showDimensions: boolean;
  viewport: Viewport;
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    selectedZoneId: null,
    selectedEdgeId: null,
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
    selectZone(zoneId: string | null) {
      this.selectedZoneId = zoneId;
      this.selectedEdgeId = null;
    },
    selectEdge(wallId: string | null) {
      this.selectedEdgeId = wallId;
      this.selectedZoneId = null;
    },
    clearSelection() {
      this.selectedZoneId = null;
      this.selectedEdgeId = null;
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
