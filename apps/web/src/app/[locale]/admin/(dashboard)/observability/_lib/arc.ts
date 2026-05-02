/** Path for an SVG arc on a half-circle (left to right, top half). t∈[0,1]. */
export function arcPath(cx: number, cy: number, r: number, tStart: number, tEnd: number): string {
  const angleStart = Math.PI * (1 - tStart);
  const angleEnd = Math.PI * (1 - tEnd);
  const a = { x: cx + r * Math.cos(angleStart), y: cy - r * Math.sin(angleStart) };
  const b = { x: cx + r * Math.cos(angleEnd), y: cy - r * Math.sin(angleEnd) };
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`;
}
