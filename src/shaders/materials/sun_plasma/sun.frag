uniform float uTime;
uniform float uIgnite; // 0 → 1 during intro identity emergence
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;

#include "chunks/noise3d.glsl"

void main() {
  vec3 p = normalize(vPos);

  // Domain-warped plasma: convection cells that shear, not lava-lamp blobs
  vec3 warp = vec3(
    fbm(p * 2.2 + vec3(uTime * 0.03, 0.0, 0.0)),
    fbm(p * 2.2 + vec3(0.0, uTime * 0.025, 7.3)),
    fbm(p * 2.2 + vec3(3.1, 0.0, uTime * 0.02))
  ) - 0.5;
  float n1 = fbm(p * 3.0 + warp * 1.4 + vec3(uTime * 0.045, uTime * 0.02, 0.0));
  float n2 = fbm(p * 7.0 + warp * 2.2 - vec3(0.0, uTime * 0.06, uTime * 0.03));
  // Photosphere granulation: fine convection texture
  float gran = vnoise(p * 34.0 + warp * 3.0 + vec3(uTime * 0.08));
  float plasma = n1 * 0.55 + n2 * 0.3 + gran * 0.15;

  // Muted solar palette — scientific realism, never neon
  vec3 core  = vec3(1.00, 0.86, 0.62);
  vec3 mid   = vec3(0.98, 0.62, 0.28);
  vec3 deep  = vec3(0.55, 0.22, 0.08);
  vec3 col = mix(deep, mid, smoothstep(0.25, 0.6, plasma));
  col = mix(col, core, smoothstep(0.6, 0.9, plasma));

  // Fresnel limb brightening (corona hint; real corona is a separate shell later)
  float fresnel = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.5);
  col += vec3(1.0, 0.8, 0.55) * fresnel * 0.9;

  // Energy pulse — slow, breathing
  col *= 0.92 + 0.08 * sin(uTime * 0.7 + plasma * 6.2831);

  // Push peaks past the bloom threshold — the sun must burn, not sit
  col *= 1.35;
  col *= uIgnite;
  gl_FragColor = vec4(col, 1.0);
}
