import { nextHorizontalPanelId } from '../model/HorizontalPanels.js';

const LEGACY_LID_ID = 'lid';
const LEGACY_LID_EDGE_PREFIX = `${LEGACY_LID_ID}:`;

function renamedLidKey(key, panelId) {
  if (key === LEGACY_LID_ID) return panelId;
  if (key.startsWith(LEGACY_LID_EDGE_PREFIX)) return `${panelId}:${key.slice(LEGACY_LID_EDGE_PREFIX.length)}`;
  return key;
}

function withLidKeysRenamed(entries, panelId) {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [renamedLidKey(key, panelId), value]));
}

function assertLidIsAnObject(lid) {
  if (typeof lid !== 'object' || lid === null) throw new Error(`migrateLegacyLid: the saved lid should be an object, got ${JSON.stringify(lid)}`);
}

function isLegacyLid(lid) {
  return 'mode' in lid || 'insertHeightMm' in lid;
}

function isEnabledRecessedLid(lid) {
  return lid.enabled && (lid.mode ?? 'recessed') === 'recessed';
}

export function migrateLegacyLid(project) {
  const { lid } = project;
  assertLidIsAnObject(lid);
  if (!isLegacyLid(lid)) return project;
  if (!isEnabledRecessedLid(lid)) return { ...project, lid: { enabled: lid.enabled } };
  const id = nextHorizontalPanelId(project.horizontalPanels);
  return {
    ...project,
    lid: { enabled: false },
    horizontalPanels: [...project.horizontalPanels, { id, heightMm: lid.insertHeightMm, coverage: lid.coverage ?? null }],
    pieceHoles: withLidKeysRenamed(project.pieceHoles, id),
    pieceNotches: withLidKeysRenamed(project.pieceNotches, id),
  };
}
