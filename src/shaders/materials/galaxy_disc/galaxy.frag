uniform float uTime;
uniform float uOuterRadius;
uniform float uArms;
uniform float uTwist;
uniform float uReveal;      // 0 -> 1 formation fade-in
uniform float uLayerAlpha;  // volumetric slice opacity (1.0 = mid plane)
uniform float uSeed;        // per-slice noise seed (kept 0 so slices stay structurally coherent)
uniform float uBeaconTheta; // disc-local angle of the destination-arm cue
varying vec3 vPosL;
varying vec3 vNormalW;

#include "chunks/noise3d.glsl"

// The spiral / warp / clump math below is mirrored CPU-side in HeroGalaxy.tsx
// (armDensity) so the point stars and gas sprites land on the same broken
// arms this shader draws. Any constant changed here must change there too.

void main() {
  float r = length(vPosL.xz);
  float rn = r / uOuterRadius;
  if (rn > 1.0) discard;

  float theta = atan(vPosL.z, vPosL.x) + uTime * 0.0012;

  // Broken arms: domain-warp the log-spiral phase so no stretch of arm sits
  // on the ideal curve. The warp fades toward the core so the bulge holds.
  vec2 w = vPosL.xz * 0.00016;
  float warp = (fbm(vec3(w.x, uSeed, w.y)) - 0.5) * 2.4
             + (fbm(vec3(w.x * 3.7 + 19.0, uSeed + 19.0, w.y * 3.7 + 19.0)) - 0.5) * 0.9;
  float phase = theta - uTwist * log(max(r, 1.0)) + warp * smoothstep(0.06, 0.4, rn);

  float armWave = sin(uArms * phase) * 0.5 + 0.5;
  // Arm width breathes along the spiral — swollen star-forming stretches
  // pinch down to threads. Sampled in (radius, phase) so it tracks each arm.
  float widthMod = fbm(vec3(rn * 4.0 + 3.0, phase * 0.9, uSeed + 67.0));
  float arms = pow(smoothstep(0.06 + widthMod * 0.42, 0.9, armWave), 1.3);
  // Weak offset harmonic -> partial spur arms between the two majors
  float spurWave = sin(uArms * 2.0 * phase + 2.3) * 0.5 + 0.5;
  arms = max(arms, pow(smoothstep(0.7, 0.98, spurWave), 2.0) * 0.4);

  // Lopsidedness: one half of the disc denser than the other
  float lop = 0.72 + 0.28 * sin(theta + rn * 1.2 + 0.9);

  // Star-cloud knots and true gaps: contrast noise carves the arms into
  // bright stellar associations separated by real breaks.
  vec2 c = vPosL.xz * 0.00105;
  float knots = smoothstep(0.34, 0.8, fbm(vec3(c.x + 7.0, uSeed + 41.0, c.y + 7.0)));
  vec2 b = vPosL.xz * 0.00034;
  float breaks = smoothstep(0.18, 0.44, fbm(vec3(b.x + 31.0, uSeed + 97.0, b.y + 31.0)));
  float armLight = arms * (0.3 + 0.95 * knots) * breaks * lop;

  float radialFalloff = smoothstep(1.0, 0.32, rn) * (0.32 + 0.68 * smoothstep(0.015, 0.16, rn));
  // Bulge: wider and softer than before — the peak was clipping to white.
  // The out-of-plane layering comes from the CoreGlow sprites, not this term.
  float coreBulge = pow(smoothstep(0.22, 0.0, rn), 1.5);

  // Stellar populations: golden bulge -> warm mid-disc -> blue-white rim
  vec3 coreCol = vec3(1.0, 0.8, 0.52);
  vec3 base = mix(vec3(1.0, 0.9, 0.74), vec3(0.6, 0.71, 1.0), smoothstep(0.14, 0.72, rn));

  // Pink HII pockets riding the knots; blue OB clusters biased outward
  float hii = smoothstep(0.66, 0.92, fbm(vPosL * 0.0016 + vec3(50.0, uSeed * 13.0, 0.0))) * armLight;
  float ob = smoothstep(0.68, 0.93, fbm(vPosL * 0.0024 - vec3(30.0, uSeed * 7.0, 10.0))) * armLight * smoothstep(0.15, 0.45, rn);
  // Faint purple molecular haze between the arms — inter-arm space is not black
  float interArm = (1.0 - arms) * smoothstep(0.9, 0.3, rn) * smoothstep(0.12, 0.3, rn);
  float mol = fbm(vec3(vPosL.x * 0.0005 + 77.0, uSeed + 29.0, vPosL.z * 0.0005 + 77.0)) * interArm;

  vec3 col = base * armLight * radialFalloff * 1.45;
  col += coreCol * coreBulge * (0.85 + 0.25 * fbm(vPosL * 0.0018));
  col += vec3(1.0, 0.47, 0.6) * hii * 0.85;
  col += vec3(0.5, 0.68, 1.0) * ob * 0.7;
  col += vec3(0.4, 0.32, 0.62) * mol * 0.35;
  col += vec3(0.5, 0.75, 0.85) * armLight * radialFalloff * 0.1; // faint cyan scatter

  // Dust lanes: filamentary absorption hugging the arms' concave edge.
  // Sampled in (radius, phase) space so the wisps stretch along the spiral.
  float dustWave = sin(uArms * phase - 0.62) * 0.5 + 0.5;
  float dustFil = fbm(vec3(rn * 7.0, phase * 1.35, uSeed + 5.0));
  float dust = smoothstep(0.42, 0.78, dustWave * (0.35 + 0.65 * dustFil))
             * smoothstep(0.1, 0.3, rn) * smoothstep(0.95, 0.5, rn);
  col = mix(col, col * vec3(0.3, 0.2, 0.14), dust * 0.95);

  // Giant molecular clouds: big black patches that carve the glow — the
  // galaxy is shaped by darkness as much as by light. Mirrored in
  // armDensity so stars thin out inside the same shadows.
  vec2 m = vPosL.xz * 0.00052;
  float darkCloud = smoothstep(0.5, 0.8, fbm(vec3(m.x + 13.0, uSeed + 71.0, m.y + 13.0)))
                  * smoothstep(0.1, 0.28, rn);
  col = mix(col, col * vec3(0.16, 0.12, 0.1), darkCloud * 0.9);

  // Destination cue: a soft brightening where the journey will dive — pulls
  // the eye toward one arm without ever reading as a UI element.
  float dAng = atan(sin(theta - uBeaconTheta), cos(theta - uBeaconTheta));
  float beacon = exp(-dAng * dAng * 5.0) * exp(-pow((rn - 0.52) / 0.16, 2.0));
  col += vec3(0.85, 0.9, 1.0) * beacon * armLight * 0.9;

  // Alpha: arms dissolve into mist — noise-eroded rim, never a clean cutoff
  float edgeNoise = fbm(vec3(vPosL.x * 0.00028 + 3.0, uSeed + 53.0, vPosL.z * 0.00028 + 3.0));
  float edge = smoothstep(1.02, 0.66, rn + (edgeNoise - 0.5) * 0.34);
  float alpha = armLight * radialFalloff * 1.2 + coreBulge * 0.8 + mol * 0.35 + beacon * armLight * 0.25;
  alpha *= edge * (1.0 - dust * 0.5) * (1.0 - darkCloud * 0.55);
  alpha *= uReveal * uLayerAlpha;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
