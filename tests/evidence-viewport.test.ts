import { expect, it } from "vitest";
import {
  graphPointer,
  initialGraphView,
  zoomGraph,
} from "../src/lib/career/evidence-viewport";

it("zooms around the pointer and maps node drags back to graph coordinates", () => {
  const view = { scale: 1.4, x: -80, y: -20 };
  const pointer = { x: 210, y: 310 };
  const before = graphPointer(view, pointer.x, pointer.y);
  const zoomed = zoomGraph(view, -300, pointer.x, pointer.y);
  expect(zoomed.scale).toBeGreaterThan(view.scale);
  const after = graphPointer(zoomed, pointer.x, pointer.y);
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
  const dragged = graphPointer(zoomed, pointer.x + 40, pointer.y + 20);
  expect(dragged.x - after.x).toBeCloseTo(40 / zoomed.scale);
  expect(dragged.y - after.y).toBeCloseTo(20 / zoomed.scale);
});

it("bounds magnification and restores a fitted graph", () => {
  expect(zoomGraph(initialGraphView, -100000, 0, 0).scale).toBe(3);
  expect(zoomGraph(initialGraphView, 100000, 0, 0).scale).toBe(0.6);
  expect(graphPointer(initialGraphView, 30, 40)).toEqual({ x: 30, y: 40 });
});
