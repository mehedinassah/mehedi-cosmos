uniform float uTime;
uniform float uIgnite;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;

#include "chunks/noise3d.glsl"

void main() {
  vec3 p = normalize(vPos);

  // Photosphere granulation: fine convection cells (high-freq, slow churn)
  // layered under coarser active-region structure (low-freq, drifting).
  float granulation = fbm(p * 22.0 + vec3(uTime * 0.06, uTime * 0.03, 0.0));
  float macro = fbm(p * 3.2 + vec3(uTime * 0.02, -uTime * 0.015, 0.0));
  float plasma = mix(macro, granulation, 0.4);

  // Active regions: brighter knotted patches that hint at magnetic structure
  float active = smoothstep(0.66, 0.92, fbm(p * 5.5 - vec3(uTime * 0.01)));

  vec3 core  = vec3(1.00, 0.90, 0.68);
  vec3 mid   = vec3(0.99, 0.66, 0.30);
  vec3 deep  = vec3(0.62, 0.24, 0.07);
  vec3 col = mix(deep, mid, smoothstep(0.25, 0.6, plasma));
  col = mix(col, core, smoothstep(0.6, 0.9, plasma));
  col += vec3(1.0, 0.85, 0.5) * active * 0.5;

  // Limb darkening — photosphere is optically thinner at the edge, so it's
  // actually DARKER at grazing angles (the physically correct opposite of
  // a naive fresnel rim). This alone reads as "real star" vs "glowing ball".
  float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
  float limbDark = mix(0.35, 1.0, pow(mu, 0.42));
  col *= limbDark;

  // Corona bleed right at the true limb (thin, bright, separate from the
  // darkened photosphere edge below it)
  float coronaEdge = smoothstep(0.0, 0.09, 1.0 - mu) * smoothstep(0.16, 0.0, 1.0 - mu);
  col += vec3(1.0, 0.82, 0.55) * coronaEdge * 1.4;

  col *= 0.94 + 0.06 * sin(uTime * 0.8 + plasma * 6.2831);
  col *= uIgnite;
  gl_FragColor = vec4(col, 1.0);
}
