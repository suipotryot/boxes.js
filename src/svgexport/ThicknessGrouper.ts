import type { Panel } from '@/domain/models/Panel';

/** Groups panels by material thickness, since each thickness is cut from
 * a separate sheet and nested on its own laser bed pages. */
export function groupByThickness(panels: Panel[]): Map<number, Panel[]> {
  const groups = new Map<number, Panel[]>();
  for (const panel of panels) {
    const group = groups.get(panel.materialThickness);
    if (group) {
      group.push(panel);
    } else {
      groups.set(panel.materialThickness, [panel]);
    }
  }
  return groups;
}
