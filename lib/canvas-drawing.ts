/** Lines need length; area shapes need both dimensions. Zero-length clicks are ignored. */
export function hasDrawableSize(type: string, width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  return type === "line" || type === "arrow"
    ? Math.hypot(width, height) > 1
    : Math.abs(width) > 1 && Math.abs(height) > 1;
}
