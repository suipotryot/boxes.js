import { nextHorizontalPanelId } from '../model/HorizontalPanels.js';

const LEGACY_LID_ID = 'lid';
const LEGACY_LID_EDGE_PREFIX = `${LEGACY_LID_ID}:`;

function lidKeyRenamedTo(panelId, key) {
  if (key === LEGACY_LID_ID) return panelId;
  if (key.startsWith(LEGACY_LID_EDGE_PREFIX)) return `${panelId}:${key.slice(LEGACY_LID_EDGE_PREFIX.length)}`;
  return key;
}

function withLidKeysRenamedTo(panelId, entries) {
  return Object.fromEntries(Object.entries(entries).map(([key, value]) => [lidKeyRenamedTo(panelId, key), value]));
}

function isLegacyLid(lid) {
  return 'mode' in lid || 'insertHeightMm' in lid;
}

function isEnabledRecessedLid(lid) {
  return lid.enabled && (lid.mode ?? 'recessed') === 'recessed';
}

export function migrateRecessedLid(project) {
  const { lid } = project;
  if (!isLegacyLid(lid)) return project;
  if (!isEnabledRecessedLid(lid)) return { ...project, lid: { enabled: lid.enabled } };
  const id = nextHorizontalPanelId(project.horizontalPanels);
  return {
    ...project,
    lid: { enabled: false },
    horizontalPanels: [...project.horizontalPanels, { id, heightMm: lid.insertHeightMm, coverage: lid.coverage ?? null }],
    pieceHoles: withLidKeysRenamedTo(id, project.pieceHoles),
    pieceNotches: withLidKeysRenamedTo(id, project.pieceNotches),
  };
}
