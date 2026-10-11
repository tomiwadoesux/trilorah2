// Signed distance to an axis-aligned box (negative inside). extent = half width/height.
export fn sdf_box(p: vec2f, center: vec2f, extent: vec2f) -> f32 {
  let q = abs(p - center) - extent;
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0);
}
