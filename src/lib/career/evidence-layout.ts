export type MapSize = { width: number; height: number };
export type MapPoint = { x: number; y: number };

/** Reserve room for hit targets, labels and glow before applying any motion. */
export function containPoint(
  point: MapPoint,
  size: MapSize,
  compact = false,
): MapPoint {
  const horizontal = Math.min(
    40,
    ((compact ? 40 : 56) / Math.max(1, size.width)) * 100,
  );
  const top = Math.min(
    35,
    ((compact ? 24 : 44) / Math.max(1, size.height)) * 100,
  );
  const bottom = Math.min(
    35,
    ((compact ? 50 : 76) / Math.max(1, size.height)) * 100,
  );
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
  const compact = count > 12;
  if (position) return containPoint(position, size, compact);
  const min = containPoint({ x: 0, y: 0 }, size, compact);
  const max = containPoint({ x: 100, y: 100 }, size, compact);
  const width = ((max.x - min.x) * size.width) / 100;
  const height = ((max.y - min.y) * size.height) / 100;
  const columns = Math.max(
    1,
    Math.min(
      count,
      Math.ceil(Math.sqrt((count * width) / Math.max(1, height))),
    ),
  );
  const rows = Math.ceil(count / columns);
  const grid = {
    x: min.x + (((index % columns) + 0.5) / columns) * (max.x - min.x),
    y: min.y + ((Math.floor(index / columns) + 0.5) / rows) * (max.y - min.y),
  };
  const angle = (index / count) * Math.PI * 2;
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
  const layouts = [
    grid,
    {
      x: center.x + Math.cos(angle) * (max.x - min.x) * 0.43,
      y: center.y + Math.sin(angle) * (max.y - min.y) * 0.43,
    },
    {
      x:
        min.x +
        (index % 2 === 0 ? 0.3 : 0.7) * (max.x - min.x) +
        Math.cos(angle * 2) * (max.x - min.x) * 0.15,
      y: center.y + Math.sin(angle) * (max.y - min.y) * 0.43,
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
    compact,
  );
}
