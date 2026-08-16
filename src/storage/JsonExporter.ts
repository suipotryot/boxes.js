import type { Project } from '@/domain/models/Project';

export function exportProjectAsJson(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFileName(project.name) || 'boxes-project'}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importProjectFromFile(file: File): Promise<Project | null> {
  const text = await file.text();
  return parseProjectJson(text);
}

export function parseProjectJson(text: string): Project | null {
  try {
    const data: unknown = JSON.parse(text);
    return isValidProjectShape(data) ? data : null;
  } catch {
    return null;
  }
}

/** Minimal structural validation -- enough to reject garbage/unrelated JSON
 * without trying to fully re-validate every nested field. */
export function isValidProjectShape(data: unknown): data is Project {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const p = data as Record<string, unknown>;
  if (typeof p.id !== 'string' || typeof p.name !== 'string') {
    return false;
  }
  if (!Array.isArray(p.colors)) {
    return false;
  }
  if (typeof p.config !== 'object' || p.config === null) {
    return false;
  }
  if (typeof p.zoneTree !== 'object' || p.zoneTree === null) {
    return false;
  }
  const config = p.config as Record<string, unknown>;
  const requiredConfigKeys = ['outerThickness', 'innerThickness', 'outerColorId', 'dimX', 'dimY', 'hasBottom'];
  return requiredConfigKeys.every((key) => key in config);
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '_');
}
