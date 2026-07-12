uniform float uTime;
uniform vec3 uCameraPos;
uniform float uIgnite;
varying vec3 vNormalW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

// Outer corona shell — angular streamers hugging the limb. Alpha is gated
// by the view-space silhouette so the shell reads as a corona at ANY
// distance; ungated, a close camera sees the whole shell as a brown ball.
void main() {
  vec3 n = normalize(vNormalW);
  vec3 sp = normalize(vPosL);

  // Seamless angular coordinate (raw atan wraps discontinuously at +-pi)
  float ang = atan(sp.z, sp.x);
  float streamers = fbm(vec3(cos(ang) * 1.8, sin(ang) * 1.8 + sp.y * 3.0, uTime * 0.02));
  streamers = pow(smoothstep(0.35, 0.95, streamers), 1.6);

  vec3 V = normalize(uCameraPos - vPosL);
  // BackSide shell seen from outside: the visible band runs from the shell's
  // own silhouette (mu ~ 0, OUTER edge) to the occluding photosphere edge
  // (mu ~ 0.5). Peak against the photosphere and feather outward to nothing,
  // so the corona reads as light leaving the star, not a dark textured ring.
  float mu = abs(dot(n, V));
  float rim = pow(smoothstep(0.02, 0.5, mu), 1.3);

  vec3 col = mix(vec3(1.0, 0.6, 0.28), vec3(1.0, 0.9, 0.7), streamers);
  // Bright base glow + wisp variation: pure streamer-noise alpha averages
  // ~0.1, which additive-renders as dark dirt around the limb up close
  float alpha = (0.18 + 0.9 * streamers) * rim * 1.8 * uIgnite;
  gl_FragColor = vec4(col, alpha);
}
