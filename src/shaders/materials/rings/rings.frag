uniform vec3 uSunPos;
uniform vec3 uPlanetPos;
uniform float uPlanetR;
uniform float uInnerR;
uniform float uOuterR;
uniform float uSeed;
uniform sampler2D uMap; // real ring scan (radius across U): color + alpha

varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

// Planar ring: REAL ring imagery for the band/gap structure, lit by the
// sun, with the planet's cast shadow sweeping across the far side.
void main() {
  // RingGeometry lies in the LOCAL XY plane (the mesh is rotated into the
  // ecliptic at the object level) — measuring xz here discards the annulus
  // except two side lobes
  float r = length(vPosL.xy);
  float t = (r - uInnerR) / (uOuterR - uInnerR);
  if (t < 0.0 || t > 1.0) discard;

  vec4 ring = texture2D(uMap, vec2(t, 0.5));
  // Soft inner/outer edges
  float edge = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.9, 1.0, t));

  // Sun illumination + planet shadow: occluded where the planet blocks the sun
  vec3 toSun = normalize(uSunPos - vPosW);
  vec3 toPlanet = uPlanetPos - vPosW;
  float along = dot(toPlanet, toSun);
  float perp = length(toPlanet - toSun * along);
  float shadow = (along > 0.0) ? smoothstep(uPlanetR * 0.98, uPlanetR * 1.25, perp) : 1.0;

  vec3 col = ring.rgb * (0.1 + 0.9 * shadow) * 0.85;

  gl_FragColor = vec4(col, ring.a * edge * 0.95);
}
