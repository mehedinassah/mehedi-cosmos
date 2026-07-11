uniform vec3 uSunPos;
uniform vec3 uPlanetPos;
uniform float uPlanetR;
uniform float uInnerR;
uniform float uOuterR;
uniform float uSeed;

varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

// Planar ring: radial bands + gaps, dusty muted tones, lit by the sun,
// with the planet's cast shadow sweeping across the far side.
void main() {
  float r = length(vPosL.xz);
  float t = (r - uInnerR) / (uOuterR - uInnerR);
  if (t < 0.0 || t > 1.0) discard;

  // Radial band structure: layered 1D noise = ringlets and gaps
  float bands = vnoise(vec3(r * 0.35 + uSeed, 0.0, 0.0)) * 0.6
              + vnoise(vec3(r * 1.7 + uSeed * 3.0, 0.0, 0.0)) * 0.4;
  float gaps = smoothstep(0.28, 0.42, bands);
  // Soft inner/outer edges
  float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.82, 1.0, t));

  // Dusty, muted palette — icy rock, never neon
  vec3 col = mix(vec3(0.42, 0.38, 0.33), vec3(0.62, 0.60, 0.57), bands);

  // Sun illumination + planet shadow: occluded where the planet blocks the sun
  vec3 toSun = normalize(uSunPos - vPosW);
  vec3 toPlanet = uPlanetPos - vPosW;
  float along = dot(toPlanet, toSun);
  float perp = length(toPlanet - toSun * along);
  float shadow = (along > 0.0) ? smoothstep(uPlanetR * 0.98, uPlanetR * 1.25, perp) : 1.0;

  col *= 0.06 + 0.94 * shadow;

  gl_FragColor = vec4(col, gaps * edge * 0.85);
}
