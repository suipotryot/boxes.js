import { describe, expect, it } from 'vitest';

import { isValidProjectShape, parseProjectJson } from '../JsonExporter';

function validProject() {
  return {
    id: 'p1',
    name: 'My Box',
    colors: [{ id: 'c1', color: '#fff', heightMm: 40 }],
    config: {
      outerThickness: 4,
      innerThickness: 3,
      outerColorId: 'c1',
      baseWallHeightMm: 40,
      dimX: { value: 100, mode: 'inner' },
      dimY: { value: 80, mode: 'inner' },
      hasBottom: true,
      shelf: null,
      advanced: {},
    },
    zoneTree: { kind: 'leaf', id: 'z1' },
  };
}

describe('isValidProjectShape', () => {
  it('accepts a well-formed project', () => {
    expect(isValidProjectShape(validProject())).toBe(true);
  });

  it('rejects null and primitives', () => {
    expect(isValidProjectShape(null)).toBe(false);
    expect(isValidProjectShape(42)).toBe(false);
    expect(isValidProjectShape('hello')).toBe(false);
  });

  it('rejects an object missing required top-level fields', () => {
    const { name: _name, ...rest } = validProject();
    expect(isValidProjectShape(rest)).toBe(false);
  });

  it('rejects a project whose colors field is not an array', () => {
    expect(isValidProjectShape({ ...validProject(), colors: 'not-an-array' })).toBe(false);
  });

  it('rejects a config missing required keys (e.g. an unrelated JSON file)', () => {
    expect(isValidProjectShape({ ...validProject(), config: { foo: 'bar' } })).toBe(false);
  });

  it('rejects a project with a non-object zoneTree', () => {
    expect(isValidProjectShape({ ...validProject(), zoneTree: 'oops' })).toBe(false);
  });
});

describe('parseProjectJson', () => {
  it('parses valid project JSON', () => {
    const project = validProject();
    const result = parseProjectJson(JSON.stringify(project));
    expect(result).toEqual(project);
  });

  it('returns null for malformed JSON', () => {
    expect(parseProjectJson('{not valid json')).toBeNull();
  });

  it('returns null for valid JSON that is not a project (e.g. an unrelated file)', () => {
    expect(parseProjectJson(JSON.stringify({ hello: 'world' }))).toBeNull();
  });
});
