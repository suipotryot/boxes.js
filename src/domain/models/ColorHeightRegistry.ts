export interface ColorEntry {
  id: string;
  color: string;
  heightMm: number;
  label?: string;
}

export class ColorHeightRegistry {
  constructor(public entries: ColorEntry[] = []) {}

  getHeight(colorId: string): number {
    return this.getEntry(colorId).heightMm;
  }

  getEntry(colorId: string): ColorEntry {
    const entry = this.entries.find((e) => e.id === colorId);
    if (!entry) {
      throw new Error(`Unknown colorId: ${colorId}`);
    }
    return entry;
  }

  findOrCreateByColor(hex: string, defaultHeight: number): ColorEntry {
    const existing = this.entries.find((e) => e.color.toLowerCase() === hex.toLowerCase());
    if (existing) {
      return existing;
    }
    const entry: ColorEntry = { id: crypto.randomUUID(), color: hex, heightMm: defaultHeight };
    this.entries.push(entry);
    return entry;
  }

  updateHeight(id: string, heightMm: number): void {
    this.getEntry(id).heightMm = heightMm;
  }
}
