uniform float uTime;
uniform float uOuterRadius;
uniform float uArms;
uniform float uTwist;
uniform float uReveal; // 0 -> 1 formation fade-in
varying vec3 vPosL;
varying vec3 vNormalW;

#include "chunks/noise3d.glsl"

void main() {
  float r = length(vPosL.xz);
  float theta = atan(vPosL.z, vPosL.x) + uTime * 0.0015; // extremely slow rotation

  float rn = r / uOuterRadius; // 0..1
  if (rn > 1.0) discard;

  // Logarithmic spiral bands. Sharpened into narrow arms (rather than fat
  // lobes) so the disc reads as a spiral galaxy, not a pinwheel.
  float logSpiral = theta - uTwist * log(max(r, 1.0));
  float armWave = sin(uArms * logSpiral) * 0.5 + 0.5;
  float arms = pow(smoothstep(0.28, 0.92, armWave), 1.3);

  // Dust lanes: independent fbm, darkens unevenly along/between arms
  vec3 dustP = vec3(vPosL.x * 0.00045, vPosL.y * 0.02, vPosL.z * 0.00045);
  float dust = fbm(dustP + vec3(0.0, uTime * 0.0003, 0.0));
  float dustMask = smoothstep(0.35, 0.75, dust);

  // Radial falloff: dense core, thin disc edge, soft inner bulge
  float radialFalloff = smoothstep(1.0, 0.35, rn) * (0.35 + 0.65 * smoothstep(0.02, 0.18, rn));
  float coreBulge = smoothstep(0.14, 0.0, rn);

  // Base stellar population color: warm gold core -> blue-white outer disc
  vec3 coreCol = vec3(1.0, 0.86, 0.62);
  vec3 armCol = vec3(0.75, 0.82, 1.0);
  vec3 base = mix(armCol, coreCol, coreBulge);

  // Pink emission nebula pockets, concentrated in arms
  float emissionField = fbm(vPosL * 0.0009 + vec3(50.0));
  float emission = smoothstep(0.62, 0.9, emissionField) * arms;
  vec3 pink = vec3(1.0, 0.45, 0.62);

  // Blue young-star clusters, also arm-concentrated but different frequency
  float clusterField = fbm(vPosL * 0.0021 - vec3(30.0, 0.0, 10.0));
  float clusters = smoothstep(0.68, 0.92, clusterField) * arms;
  vec3 blue = vec3(0.55, 0.72, 1.0);

  vec3 col = base * arms * radialFalloff;
  col += coreCol * coreBulge * 1.6;
  col += pink * emission * 0.9;
  col += blue * clusters * 0.7;
  col *= mix(0.35, 1.0, 1.0 - dustMask * arms); // dust darkens mid-arm, not everywhere

  float alpha = (arms * radialFalloff * 0.8 + coreBulge * 0.9) * uReveal;
  alpha *= smoothstep(1.0, 0.82, rn); // soft outer edge, no hard disc cutoff

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
