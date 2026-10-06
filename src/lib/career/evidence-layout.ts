export type MapSize = { width: number; height: number };
export type MapPoint = { x: number; y: number };

/** Reserve room for hit targets, labels and glow before applying any motion. */
export function containPoint(point: MapPoint, size: MapSize): MapPoint {
  const horizontal = Math.min(40, (56 / Math.max(1, size.width)) * 100);
  const top = Math.min(35, (44 / Math.max(1, size.height)) * 100);
  const bottom = Math.min(35, (76 / Math.max(1, size.height)) * 100);
  return {
    x: Math.max(horizontal, Math.min(100 - horizontal, point.x)),
    y: Math.max(top, Math.min(100 - bottom, point.y)),
  };
}

export function mapPoint(
  index: number,
  count: number,
  size: MapSize,
  time: number,
  busy: boolean,
  position?: MapPoint,
): MapPoint {
  const columns = size.width < 220 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const grid = {
    x: count === 1 || columns === 1 ? 50 : index % 2 === 0 ? 24 : 76,
    y: 12 + ((Math.floor(index / columns) + 0.5) / rows) * 70,
  };
  const angle = (index / count) * Math.PI * 2;
  const layouts = [
    grid,
    { x: 50 + Math.cos(angle) * 29, y: 46 + Math.sin(angle) * 29 },
    {
      x: (index % 2 === 0 ? 32 : 68) + Math.cos(angle * 2) * 11,
      y: 46 + Math.sin(angle) * 30,
    },
  ];
  const cycle = time / 2600;
  const phase = Math.floor(cycle) % layouts.length;
  const blend = (1 - Math.cos((cycle % 1) * Math.PI)) / 2;
  const from = layouts[phase];
  const to = layouts[(phase + 1) % layouts.length];
  const base = busy
    ? {
        x: from.x + (to.x - from.x) * blend,
        y: from.y + (to.y - from.y) * blend,
      }
    : position || grid;
  return containPoint(
    {
      x: base.x + (Math.sin(time / 1800 + index * 2) * 400) / size.width,
      y: base.y + (Math.sin(time / 2200 + index * 2) * 500) / size.height,
    },
    size,
  );
}
