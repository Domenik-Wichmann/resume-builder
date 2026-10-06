import type { CareerRecord } from "./model";

/** Shuffle only published browser-visible records; keep each label and ID together. */
export function traversalRecords(
  pool: CareerRecord[],
  count: number,
  step: number,
): CareerRecord[] {
  const shuffled = [...pool];
  let seed = (step + 1) * 2654435761;
  for (let i = shuffled.length - 1; i > 0; i--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const j = (seed >>> 0) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
