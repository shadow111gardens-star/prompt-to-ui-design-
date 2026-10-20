type Point = { x: number; y: number };
/** Incremental two-finger transform, preserving the world point under the midpoint. */
export function pinchStep(previous: [Point, Point], current: [Point, Point]) {
  const midpoint = (points: [Point, Point]) => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const distance = (points: [Point, Point]) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
  const before = midpoint(previous), after = midpoint(current);
  const span = distance(previous);
  return { factor: span > 1 ? Math.max(0.25, Math.min(4, distance(current) / span)) : 1, origin: before, dx: after.x - before.x, dy: after.y - before.y };
}
