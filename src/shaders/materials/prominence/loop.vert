uniform float uTime;
uniform float uSeed;
uniform float uLife; // 0 -> 1 lifecycle (grow, hold, collapse)
varying vec2 vUv;
varying float vAlong;

#include "chunks/noise3d.glsl"

// Magnetic-rope displacement: the tube is only a scaffold. Per-frame noise
// twists and kinks it so the loop writhes like a field line, not a drawn
// spline; the lifecycle scales it out of and back into the surface.
void main() {
  vUv = uv;
  vAlong = uv.x; // TubeGeometry: u runs along the curve

  vec3 p = position;

  // Grow out of the limb, collapse back into it
  float grow = smoothstep(0.0, 0.25, uLife) * (1.0 - smoothstep(0.72, 1.0, uLife));
  p *= mix(0.92, 1.0, grow);

  // Writhe: two noise frequencies displace the rope perpendicular to itself.
  float t = uTime * 0.14 + uSeed * 17.0;
  vec3 nOff = vec3(
    fbm(p * 0.02 + vec3(t, 0.0, uSeed)),
    fbm(p * 0.02 + vec3(0.0, t, uSeed * 2.0)),
    fbm(p * 0.02 + vec3(t * 0.7, uSeed, 0.0))
  ) - 0.5;
  // Strongest at the apex (uv.x ~ 0.5), pinned at the footpoints
  float apex = sin(vAlong * 3.14159);
  p += nOff * apex * 14.0 * grow;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
