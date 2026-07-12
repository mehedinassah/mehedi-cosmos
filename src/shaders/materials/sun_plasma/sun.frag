uniform float uTime;
uniform float uIgnite;
uniform sampler2D uMap;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;
varying vec2 vUv;

#include "chunks/noise3d.glsl"

void main() {
  vec3 p = normalize(vPos);

  // Photosphere granulation: fine convection cells (high-freq, slow churn)
  // layered under coarser active-region structure (low-freq, drifting).
  float granulation = fbm(p * 22.0 + vec3(uTime * 0.06, uTime * 0.03, 0.0));
  float macro = fbm(p * 3.2 + vec3(uTime * 0.02, -uTime * 0.015, 0.0));
  float plasma = mix(macro, granulation, 0.55);

  // Active regions: brighter knotted patches that hint at magnetic structure
  float activity = smoothstep(0.66, 0.92, fbm(p * 5.5 - vec3(uTime * 0.01)));

  // Real photosphere imagery carries the identity (sunspots, cell texture,
  // color); the procedural layers keep it ALIVE — the map drifts slowly and
  // the noise modulates brightness so nothing ever reads as a still photo.
  vec3 tex = texture2D(uMap, vUv + vec2(uTime * 0.0016, 0.0)).rgb;
  vec3 col = tex * (0.62 + 0.55 * plasma);
  col += vec3(1.0, 0.85, 0.5) * activity * 0.32;

  // Limb darkening — photosphere is optically thinner at the edge, so it's
  // actually DARKER at grazing angles (the physically correct opposite of
  // a naive fresnel rim). This alone reads as "real star" vs "glowing ball".
  float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
  float limbDark = mix(0.35, 1.0, pow(mu, 0.42));
  col *= limbDark;

  // Corona bleed right at the true limb. Anchored to the silhouette
  // (mu -> 0) so it stays a limb effect at any camera distance — a band in
  // mid-mu space migrates to the middle of the disc on a close approach.
  float coronaEdge = smoothstep(0.14, 0.02, mu);
  col += vec3(1.0, 0.82, 0.55) * coronaEdge * 0.9;

  col *= 0.94 + 0.06 * sin(uTime * 0.8 + plasma * 6.2831);
  col *= uIgnite;
  gl_FragColor = vec4(col, 1.0);
}
