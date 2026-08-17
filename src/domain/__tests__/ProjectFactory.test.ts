import { describe, expect, it } from 'vitest';

import { createNewProject } from '../services/ProjectFactory';

describe('createNewProject', () => {
  const input = {
    name: 'My Box',
    outerThickness: 4,
    innerThickness: 3,
    baseWallHeightMm: 50,
    dimX: { value: 100, mode: 'inner' as const },
    dimY: { value: 80, mode: 'inner' as const },
    hasBottom: true,
  };

  it('auto-creates a single "Bords" color at baseWallHeightMm and assigns it as outerColorId', () => {
    const project = createNewProject(input);
    expect(project.colors).toHaveLength(1);
    expect(project.colors[0]!.heightMm).toBe(50);
    expect(project.colors[0]!.label).toBe('Bords');
    expect(project.config.outerColorId).toBe(project.colors[0]!.id);
  });

  it('starts with an empty divider grid (no lines yet)', () => {
    const project = createNewProject(input);
    expect(project.grid.lines).toEqual([]);
  });

  it('carries the dimensions and thicknesses through unchanged', () => {
    const project = createNewProject(input);
    expect(project.config.dimX).toEqual(input.dimX);
    expect(project.config.dimY).toEqual(input.dimY);
    expect(project.config.outerThickness).toBe(4);
    expect(project.config.innerThickness).toBe(3);
  });

  it('gives each generated project a distinct id', () => {
    const a = createNewProject(input);
    const b = createNewProject(input);
    expect(a.id).not.toBe(b.id);
  });
});
