import type { MapPoint, MapSize } from "./evidence-layout";

/** Route real connections around intervening orbs, never attach by proximity. */
export function evidencePath(
  source: MapPoint,
  target: MapPoint,
  others: MapPoint[],
  size: MapSize,
  radius: number,
): string {
  const pixels = (point: MapPoint) => ({
    x: (point.x * size.width) / 100,
    y: (point.y * size.height) / 100,
  });
  const start = pixels(source);
  const end = pixels(target);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const obstacles = others
    .map(pixels)
    .filter(
      (point) =>
        point.x >= Math.min(start.x, end.x) - 110 &&
        point.x <= Math.max(start.x, end.x) + 110 &&
        point.y >= Math.min(start.y, end.y) - 110 &&
        point.y <= Math.max(start.y, end.y) + 110,
    );
  const bend = Math.min(70, Math.max(28, length * 0.2));
  const candidates = [1, -1, 1.5, -1.5].map((side) => ({
    x: Math.max(
      8,
      Math.min(size.width - 8, middle.x - (dy / length) * bend * side),
    ),
    y: Math.max(
      8,
      Math.min(size.height - 8, middle.y + (dx / length) * bend * side),
    ),
  }));
  const clearance = (control: MapPoint) => {
    const samples = Array.from({ length: 25 }, (_, step) => {
      const t = step / 24;
      return {
        x:
          (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
        y:
          (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
      };
    });
    return Math.min(
      ...obstacles.map((point) => {
        let closest = Infinity;
        for (let i = 1; i < samples.length; i++) {
          const from = samples[i - 1];
          const to = samples[i];
          const x = to.x - from.x;
          const y = to.y - from.y;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((point.x - from.x) * x + (point.y - from.y) * y) /
                (x * x + y * y || 1),
            ),
          );
          closest = Math.min(
            closest,
            (point.x - from.x - t * x) ** 2 + (point.y - from.y - t * y) ** 2,
          );
        }
        return closest;
      }),
    );
  };
  let control = candidates[0];
  let best = clearance(control);
  for (const candidate of candidates.slice(1)) {
    if (best > (radius + 4) ** 2) break;
    const distance = clearance(candidate);
    if (distance > best) {
      control = candidate;
      best = distance;
    }
  }
  return `M ${source.x} ${source.y} Q ${(control.x / size.width) * 100} ${(control.y / size.height) * 100} ${target.x} ${target.y}`;
}
