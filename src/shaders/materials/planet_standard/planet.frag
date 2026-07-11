uniform float uTime;
uniform float uSeed;
uniform vec3 uDeep;   // lowlands / oceans
uniform vec3 uMid;    // continents
uniform vec3 uHigh;   // peaks / ice
uniform vec3 uAtmo;   // scattering tint
uniform vec3 uSunPos; // world-space (origin)
uniform vec3 uCameraPos;
uniform float uNight; // 0–1 city-light intensity on dark side

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

void main() {
  vec3 n = normalize(vNormalW);
  vec3 sp = normalize(vPosL);

  // Terrain: coarse continents + fine relief
  float h = fbm(sp * 3.2 + uSeed * 13.7);
  float detail = fbm(sp * 11.0 + uSeed * 7.1 + vec3(uTime * 0.002));

  vec3 surf = mix(uDeep, uMid, smoothstep(0.34, 0.55, h));
  surf = mix(surf, uHigh, smoothstep(0.62, 0.84, h));
  surf *= 0.82 + 0.36 * detail; // relief shading breaks the matte-ball look

  // Single dominant light: the sun. Hard terminator, tiny bounce fill.
  vec3 L = normalize(uSunPos - vPosW);
  float ndl = dot(n, L);
  float day = smoothstep(-0.12, 0.28, ndl);
  vec3 V = normalize(uCameraPos - vPosW);
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 24.0) * smoothstep(0.3, 0.42, h < 0.34 ? 1.0 : 0.0);

  vec3 col = surf * (0.018 + day * 1.05) + vec3(1.0, 0.95, 0.85) * spec * 0.25 * day;

  // Night-side civilization (city lights along mid-altitude bands)
  if (uNight > 0.0) {
    float cities = smoothstep(0.55, 0.9, fbm(sp * 16.0 + uSeed * 3.3)) * smoothstep(0.4, 0.6, h);
    col += vec3(1.0, 0.82, 0.55) * cities * (1.0 - day) * uNight * 0.85;
  }

  // Atmospheric rim scattering — day-biased, vanishes face-on
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.2);
  col += uAtmo * fres * (0.12 + 0.85 * day);

  gl_FragColor = vec4(col, 1.0);
}
