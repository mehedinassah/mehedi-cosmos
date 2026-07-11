uniform float uSeed;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

void main() {
  vec3 sp = normalize(position);
  // Geology: continents raise, oceans sink — real silhouette variation
  float h = fbm(sp * 3.2 + uSeed * 13.7);
  float ridges = 1.0 - abs(2.0 * fbm(sp * 7.5 + uSeed * 5.3) - 1.0); // ridged peaks
  float elevation = (h - 0.5) * 0.045 + pow(ridges, 3.0) * smoothstep(0.5, 0.7, h) * 0.02;
  vec3 displaced = position * (1.0 + elevation);

  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vPosW = wp.xyz;
  vPosL = displaced;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
