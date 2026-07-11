uniform float uTime;
uniform float uSeed;
uniform float uCloudCover;
uniform vec3 uSunPos;
uniform vec3 uCameraPos;

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

void main() {
  vec3 sp = normalize(vPosL);
  vec3 n = normalize(vNormalW);

  // Same field the surface samples for shadows — clouds drift, shadows follow
  float field = fbm(sp * 4.0 + vec3(uTime * 0.004, 0.0, uTime * 0.0025) + uSeed * 2.0);
  float wisps = fbm(sp * 9.0 - vec3(uTime * 0.006, uTime * 0.002, 0.0) + uSeed);
  float cover = smoothstep(0.52, 0.78, field) * (0.55 + 0.45 * wisps) * uCloudCover;

  vec3 L = normalize(uSunPos - vPosW);
  float day = smoothstep(-0.08, 0.3, dot(n, L));
  // Self-shading: cloud tops brighten toward the sun
  vec3 cloudCol = mix(vec3(0.55, 0.58, 0.66), vec3(1.0, 0.98, 0.94), day);
  // Warm sunset tint at the terminator
  float term = smoothstep(0.0, 0.3, day) * (1.0 - smoothstep(0.3, 0.7, day));
  cloudCol += vec3(0.5, 0.22, 0.08) * term;

  // Fade at the limb so the shell never reads as a hard sphere edge
  vec3 V = normalize(uCameraPos - vPosW);
  float limbFade = smoothstep(0.0, 0.25, dot(n, V));

  gl_FragColor = vec4(cloudCol, cover * (0.06 + 0.94 * day) * limbFade);
}
