// Type shim for the verbatim v3 reference renderer (golden source for the
// fidelity test). Intentionally loose — this file is the untouched v3 original;
// the typed, faithful port lives at client/src/dunkchar/generator.ts.
export function generateSpriteSheet(character?: unknown): { canvas: unknown; animations: unknown; cfg: unknown };
export function renderPreview(character?: unknown, animCode?: number, frame?: number, scale?: number): unknown;
export function shade(hex: string, factor: number): string;
export const SHEET: { frameW: number; frameH: number; cols: number; rows: number };
export const SKINS: string[][];
export const HAIR_COLORS: string[];
export const HAIR_STYLES: string[];
export const ACCESSORIES: string[];
export const BUILDS: string[];
export const ANIMATIONS: Record<number, { row: number; start: number; frames: number; speed: number; hold?: boolean }>;
