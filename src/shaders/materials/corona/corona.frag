uniform float uTime;
uniform vec3 uCameraPos;
uniform float uIgnite;
varying vec3 vNormalW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

// Outer corona shell — angular streamers, not a uniform glow ring.
void main() {
  vec3 n = normalize(vNormalW);
  vec3 sp = normalize(vPosL);

  float ang = atan(sp.z, sp.x);
  float streamers = fbm(vec3(ang * 2.4, sp.y * 3.0, uTime * 0.02));
  streamers = pow(smoothstep(0.35, 0.95, streamers), 1.6);

  vec3 V = normalize(uCameraPos - vPosL);
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 1.4); // shell-space falloff proxy
  float falloff = smoothstep(1.0, 0.0, length(vPosL) / 1.0); // unused placeholder guard

  vec3 col = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.85, 0.6), streamers);
  float alpha = streamers * 0.55 * uIgnite;
  gl_FragColor = vec4(col, alpha);
}
