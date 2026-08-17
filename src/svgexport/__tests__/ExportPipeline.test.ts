import { describe, expect, it } from 'vitest';

import type { GridLine } from '@/domain/models/Grid';
import type { Project, ProjectConfig } from '@/domain/models/Project';
import { buildExportFiles } from '../ExportPipeline';

function baseConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    outerThickness: 4,
    innerThickness: 3,
    outerColorId: 'outer',
    baseWallHeightMm: 40,
    dimX: { value: 100, mode: 'inner' },
    dimY: { value: 80, mode: 'inner' },
    hasBottom: true,
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
        widthMm: 3,
        edgeWidthMm: 4,
        playMm: 0,
        extraLengthMm: 0,
        surroundingSpaces: 0,
      },
    },
    ...overrides,
  };
}

describe('buildExportFiles', () => {
  it('produces one file per (thickness, page) with a descriptive filename', () => {
    const line: GridLine = { id: 'v1', axis: 'x', positionMm: 40, colorId: 'divider', segmentOverrides: [] };
    const project: Project = {
      id: 'p1',
      name: 'My Box',
      config: baseConfig(),
      colors: [
        { id: 'outer', color: '#888', heightMm: 40 },
        { id: 'divider', color: '#f00', heightMm: 30 },
      ],
      grid: { lines: [line] },
    };

    const files = buildExportFiles(project);
    // Two thickness groups (outer=4mm walls+base, inner=3mm divider), one
    // page each since the bed (300x200) comfortably fits this small box.
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const file of files) {
      expect(file.filename).toMatch(/^My Box-\d+(\.\d+)?mm-page\d+of\d+\.svg$/);
      expect(file.content).toContain('<svg');
      expect(file.content).toContain('</svg>');
    }
  });

  it('forces multiple pages when the laser bed is too small to fit everything at once', () => {
    // Bed (120x100) comfortably fits every individual panel (the largest,
    // the ~108x88 base plate, still fits with room for spacing) but is far
    // smaller than the panels' combined area, so they must spill onto
    // multiple pages rather than fail outright.
    const project: Project = {
      id: 'p1',
      name: 'Tiny Bed Box',
      config: baseConfig({ advanced: { ...baseConfig().advanced, laserBedX: 120, laserBedY: 100 } }),
      colors: [{ id: 'outer', color: '#888', heightMm: 40 }],
      grid: { lines: [] },
    };

    const files = buildExportFiles(project);
    expect(files.length).toBeGreaterThan(1);
  });

  it('sanitizes unsafe filename characters from the project name', () => {
    const project: Project = {
      id: 'p1',
      name: 'Box: "special" / chars?',
      config: baseConfig(),
      colors: [{ id: 'outer', color: '#888', heightMm: 40 }],
      grid: { lines: [] },
    };
    const files = buildExportFiles(project);
    expect(files.every((f) => !/["/:*?<>|\\]/.test(f.filename.replace(/\.svg$/, '')))).toBe(true);
  });
});
