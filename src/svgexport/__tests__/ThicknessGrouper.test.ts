import { describe, expect, it } from 'vitest';

import type { Panel } from '@/domain/models/Panel';
import { groupByThickness } from '../ThicknessGrouper';

function panel(id: string, thickness: number): Panel {
  return { id, kind: 'dividerWall', materialThickness: thickness, outline: [], holes: [], sourceIds: [] };
}

describe('groupByThickness', () => {
  it('groups panels sharing the same thickness together', () => {
    const groups = groupByThickness([panel('a', 3), panel('b', 4), panel('c', 3)]);
    expect(groups.size).toBe(2);
    expect(groups.get(3)!.map((p) => p.id)).toEqual(['a', 'c']);
    expect(groups.get(4)!.map((p) => p.id)).toEqual(['b']);
  });

  it('returns an empty map for no panels', () => {
    expect(groupByThickness([]).size).toBe(0);
  });
});
