export type GraphView = { scale: number; x: number; y: number };
export const initialGraphView: GraphView = { scale: 1, x: 0, y: 0 };

/** Keep the graph point under the pointer stationary while changing magnification. */
export function zoomGraph(
  view: GraphView,
  delta: number,
  x: number,
  y: number,
): GraphView {
  const scale = Math.max(
    0.6,
    Math.min(3, view.scale * Math.exp(-delta * 0.0015)),
  );
  const ratio = scale / view.scale;
  return { scale, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio };
}

export function graphPointer(view: GraphView, x: number, y: number) {
  return { x: (x - view.x) / view.scale, y: (y - view.y) / view.scale };
}
